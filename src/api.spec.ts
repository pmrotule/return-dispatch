import * as core from "@actions/core";
import * as github from "@actions/github";
import { v4 as uuid } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchWorkflow,
  getWorkflowId,
  getWorkflowRunIds,
  getWorkflowRunJobSteps,
  getWorkflowRunUrl,
  init,
  retryOrDie,
} from "./api";

vi.mock("@actions/core");
vi.mock("@actions/github");

interface MockResponse {
  data: any;
  status: number;
}

const mockOctokit = {
  rest: {
    actions: {
      createWorkflowDispatch: async (_req?: any): Promise<MockResponse> => {
        throw new Error("Should be mocked");
      },
      getWorkflowRun: async (_req?: any): Promise<MockResponse> => {
        throw new Error("Should be mocked");
      },
      listRepoWorkflows: async (_req?: any): Promise<MockResponse> => {
        throw new Error("Should be mocked");
      },
      listWorkflowRuns: async (_req?: any): Promise<MockResponse> => {
        throw new Error("Should be mocked");
      },
      downloadWorkflowRunLogs: async (_req?: any): Promise<MockResponse> => {
        throw new Error("Should be mocked");
      },
      listJobsForWorkflowRun: async (_req?: any): Promise<MockResponse> => {
        throw new Error("Should be mocked");
      },
    },
  },
};

describe("API", () => {
  beforeEach(() => {
    vi.spyOn(core, "getInput").mockImplementation((key: string) => {
      switch (key) {
        case "token":
          return "token";
        case "ref":
          return "ref";
        case "repo":
          return "repo";
        case "owner":
          return "owner";
        case "workflow":
          return "workflow";
        case "workflow_inputs":
          return JSON.stringify({ testInput: "test" });
        case "workflow_timeout_seconds":
          return "30";
        default:
          return "";
      }
    });
    vi.spyOn(github, "getOctokit").mockReturnValue(mockOctokit as any);
    init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("dispatchWorkflow", () => {
    it("should resolve after a successful dispatch", async () => {
      vi.spyOn(
        mockOctokit.rest.actions,
        "createWorkflowDispatch",
      ).mockReturnValue(
        Promise.resolve({
          data: undefined,
          status: 204,
        }),
      );

      await dispatchWorkflow("");
    });

    it("should throw if a non-204 status is returned", async () => {
      const errorStatus = 401;
      vi.spyOn(
        mockOctokit.rest.actions,
        "createWorkflowDispatch",
      ).mockReturnValue(
        Promise.resolve({
          data: undefined,
          status: errorStatus,
        }),
      );

      await expect(dispatchWorkflow("")).rejects.toThrow(
        `Failed to dispatch action, expected 204 but received ${errorStatus}`,
      );
    });

    it("should dispatch with a distinctId in the inputs", async () => {
      const distinctId = uuid();
      let dispatchedId: string | undefined;
      vi.spyOn(
        mockOctokit.rest.actions,
        "createWorkflowDispatch",
      ).mockImplementation(async (req?: any) => {
        dispatchedId = req.inputs.distinct_id;

        return {
          data: undefined,
          status: 204,
        };
      });

      await dispatchWorkflow(distinctId);
      expect(dispatchedId).toStrictEqual(distinctId);
    });
  });

  describe("getWorkflowId", () => {
    it("should return the workflow ID for a given workflow filename", async () => {
      const mockData = {
        total_count: 3,
        workflows: [
          {
            id: 0,
            path: ".github/workflows/cake.yml",
          },
          {
            id: 1,
            path: ".github/workflows/pie.yml",
          },
          {
            id: 2,
            path: ".github/workflows/slice.yml",
          },
        ],
      };
      vi.spyOn(mockOctokit.rest.actions, "listRepoWorkflows").mockReturnValue(
        Promise.resolve({
          data: mockData,
          status: 200,
        }),
      );

      expect(await getWorkflowId("slice.yml")).toStrictEqual(
        mockData.workflows[2].id,
      );
    });

    it("should throw if a non-200 status is returned", async () => {
      const errorStatus = 401;
      vi.spyOn(mockOctokit.rest.actions, "listRepoWorkflows").mockReturnValue(
        Promise.resolve({
          data: undefined,
          status: errorStatus,
        }),
      );

      await expect(getWorkflowId("implode")).rejects.toThrow(
        `Failed to get workflows, expected 200 but received ${errorStatus}`,
      );
    });

    it("should throw if a given workflow name cannot be found in the response", async () => {
      const workflowName = "slice";
      vi.spyOn(mockOctokit.rest.actions, "listRepoWorkflows").mockReturnValue(
        Promise.resolve({
          data: {
            total_count: 0,
            workflows: [],
          },
          status: 200,
        }),
      );

      await expect(getWorkflowId(workflowName)).rejects.toThrow(
        `Unable to find ID for Workflow: ${workflowName}`,
      );
    });
  });

  describe("getWorkflowRunIds", () => {
    const workflowIdCfg = {
      token: "secret",
      ref: "feature_branch",
      repo: "repository",
      owner: "owner",
      workflow: "workflow_name",
      workflowInputs: { testInput: "test" },
      workflowTimeoutSeconds: 60,
    };

    beforeEach(() => {
      init(workflowIdCfg);
    });

    it("should get the run IDs for a given workflow ID", async () => {
      const mockData = {
        total_count: 3,
        workflow_runs: [{ id: 0 }, { id: 1 }, { id: 2 }],
      };
      vi.spyOn(mockOctokit.rest.actions, "listWorkflowRuns").mockReturnValue(
        Promise.resolve({
          data: mockData,
          status: 200,
        }),
      );

      expect(await getWorkflowRunIds(0)).toStrictEqual(
        mockData.workflow_runs.map((run) => run.id),
      );
    });

    it("should throw if a non-200 status is returned", async () => {
      const errorStatus = 401;
      vi.spyOn(mockOctokit.rest.actions, "listWorkflowRuns").mockReturnValue(
        Promise.resolve({
          data: undefined,
          status: errorStatus,
        }),
      );

      await expect(getWorkflowRunIds(0)).rejects.toThrow(
        `Failed to get Workflow runs, expected 200 but received ${errorStatus}`,
      );
    });

    it("should return an empty array if there are no runs", async () => {
      const mockData = {
        total_count: 0,
        workflow_runs: [],
      };
      vi.spyOn(mockOctokit.rest.actions, "listWorkflowRuns").mockReturnValue(
        Promise.resolve({
          data: mockData,
          status: 200,
        }),
      );

      expect(await getWorkflowRunIds(0)).toStrictEqual([]);
    });

    it("should filter by branch name", async () => {
      workflowIdCfg.ref = "/refs/heads/master";
      let parsedRef!: string;
      vi.spyOn(mockOctokit.rest.actions, "listWorkflowRuns").mockImplementation(
        async (req: any) => {
          parsedRef = req.branch;
          const mockResponse: MockResponse = {
            data: {
              total_count: 0,
              workflow_runs: [],
            },
            status: 200,
          };
          return mockResponse;
        },
      );

      await getWorkflowRunIds(0);
      expect(parsedRef).toStrictEqual("master");
    });

    it("should not use a branch filter if using a tag ref", async () => {
      workflowIdCfg.ref = "/refs/tags/1.5.0";
      let parsedRef!: string;
      vi.spyOn(mockOctokit.rest.actions, "listWorkflowRuns").mockImplementation(
        async (req: any) => {
          parsedRef = req.branch;
          const mockResponse: MockResponse = {
            data: {
              total_count: 0,
              workflow_runs: [],
            },
            status: 200,
          };
          return mockResponse;
        },
      );

      await getWorkflowRunIds(0);
      expect(parsedRef).toBeUndefined();
    });

    it("should not use a branch filter if non-standard ref", async () => {
      workflowIdCfg.ref = "/refs/cake";
      let parsedRef!: string;
      vi.spyOn(mockOctokit.rest.actions, "listWorkflowRuns").mockImplementation(
        async (req: any) => {
          parsedRef = req.branch;
          const mockResponse: MockResponse = {
            data: {
              total_count: 0,
              workflow_runs: [],
            },
            status: 200,
          };
          return mockResponse;
        },
      );

      await getWorkflowRunIds(0);
      expect(parsedRef).toBeUndefined();
    });
  });

  describe("getWorkflowRunJobSteps", () => {
    it("should get the step names for a given Workflow Run ID", async () => {
      const mockData = {
        total_count: 1,
        jobs: [
          {
            id: 0,
            steps: [
              {
                name: "Test Step 1",
                number: 1,
              },
              {
                name: "Test Step 2",
                number: 2,
              },
            ],
          },
        ],
      };
      vi.spyOn(
        mockOctokit.rest.actions,
        "listJobsForWorkflowRun",
      ).mockReturnValue(
        Promise.resolve({
          data: mockData,
          status: 200,
        }),
      );

      expect(await getWorkflowRunJobSteps(0)).toStrictEqual([
        "Test Step 1",
        "Test Step 2",
      ]);
    });

    it("should throw if a non-200 status is returned", async () => {
      const errorStatus = 401;
      vi.spyOn(
        mockOctokit.rest.actions,
        "listJobsForWorkflowRun",
      ).mockReturnValue(
        Promise.resolve({
          data: undefined,
          status: errorStatus,
        }),
      );

      await expect(getWorkflowRunJobSteps(0)).rejects.toThrow(
        `Failed to get Workflow Run Jobs, expected 200 but received ${errorStatus}`,
      );
    });

    it("should return an empty array if there are no steps", async () => {
      const mockData = {
        total_count: 1,
        jobs: [
          {
            id: 0,
            steps: undefined,
          },
        ],
      };
      vi.spyOn(
        mockOctokit.rest.actions,
        "listJobsForWorkflowRun",
      ).mockReturnValue(
        Promise.resolve({
          data: mockData,
          status: 200,
        }),
      );

      expect(await getWorkflowRunJobSteps(0)).toStrictEqual([]);
    });
  });

  describe("getWorkflowRunUrl", () => {
    it("should return the workflow run state for a given run ID", async () => {
      const mockData = {
        html_url: "master sword",
      };
      vi.spyOn(mockOctokit.rest.actions, "getWorkflowRun").mockReturnValue(
        Promise.resolve({
          data: mockData,
          status: 200,
        }),
      );

      const url = await getWorkflowRunUrl(123456);
      expect(url).toStrictEqual(mockData.html_url);
    });

    it("should throw if a non-200 status is returned", async () => {
      const errorStatus = 401;
      vi.spyOn(mockOctokit.rest.actions, "getWorkflowRun").mockReturnValue(
        Promise.resolve({
          data: undefined,
          status: errorStatus,
        }),
      );

      await expect(getWorkflowRunUrl(0)).rejects.toThrow(
        `Failed to get Workflow Run state, expected 200 but received ${errorStatus}`,
      );
    });
  });

  describe("retryOrDie", () => {
    it("should return a populated array", async () => {
      const attempt = async () => {
        return [0];
      };

      expect(await retryOrDie(attempt, 1000)).toHaveLength(1);
    });

    it("should throw if the given timeout is exceeded", async () => {
      // Never return data.
      const attempt = async () => [];

      await expect(retryOrDie(attempt, 1000)).rejects.toThrow(
        "Timed out while attempting to fetch data",
      );
    });

    it("should retry to get a populated array", async () => {
      let attemptNo = 0;
      const attempt = async () => {
        switch (attemptNo) {
          case 0:
          case 1:
            attemptNo++;
            return [];
        }

        return [0];
      };

      expect(await retryOrDie(attempt, 1500)).toHaveLength(1);
    });
  });
});
