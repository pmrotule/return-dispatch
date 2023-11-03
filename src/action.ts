import * as core from "@actions/core";

const WORKFLOW_TIMEOUT_SECONDS = 5 * 60;

/**
 * action.yaml definition.
 */
export interface ActionConfig {
  /**
   * GitHub API token for making requests.
   */
  token: string;

  /**
   * The git reference for the workflow. The reference can be a branch or tag name.
   */
  ref?: string;

  /**
   * Repository of the action to await.
   */
  repo: string;

  /**
   * Owner of the given repository.
   */
  owner: string;

  /**
   * Workflow to return an ID for. Can be the ID or the workflow filename.
   */
  workflow: string | number;

  /**
   * Workflow to return an ID for. Can be the ID or the workflow filename.
   */
  workflowTrigger: ActionWorkflowTrigger;

  /**
   * A flat JSON object, only supports strings, numbers, and booleans (as per workflow inputs API).
   */
  workflowInputs?: ActionWorkflowInputs;

  /**
   * Event type in case the workflow trigger is a repository_dispatch.
   */
  eventType?: string;

  /**
   * A flat JSON object, only supports strings, numbers, and booleans (as per workflow inputs API).
   */
  clientPayload?: ActionWorkflowInputs;

  /**
   * Time until giving up on identifying the Run ID.
   */
  workflowTimeoutSeconds: number;
}

interface ActionWorkflowInputs {
  [input: string]: string | number | boolean;
}

type ActionWorkflowTrigger = "workflow_dispatch" | "repository_dispatch";

export enum ActionOutputs {
  runId = "run_id",
}

export function getConfig(): ActionConfig {
  return {
    token: core.getInput("token", { required: true }),
    ref: core.getInput("ref") || undefined,
    repo: core.getInput("repo", { required: true }),
    owner: core.getInput("owner", { required: true }),
    workflow: getWorkflowValue(core.getInput("workflow", { required: true })),
    workflowTrigger: core.getInput("workflow_trigger") as ActionWorkflowTrigger,
    workflowInputs: getWorkflowInputs(
      core.getInput("workflow_inputs") || core.getInput("client_payload"),
    ),
    eventType: core.getInput("event_type") || undefined,
    workflowTimeoutSeconds:
      getNumberFromValue(core.getInput("workflow_timeout_seconds")) ||
      WORKFLOW_TIMEOUT_SECONDS,
  };
}

function getNumberFromValue(value: string): number | undefined {
  if (value === "") {
    return undefined;
  }

  try {
    const num = parseInt(value);

    if (isNaN(num)) {
      throw new Error("Parsed value is NaN");
    }

    return num;
  } catch {
    throw new Error(`Unable to parse value: ${value}`);
  }
}

function getWorkflowInputs(
  workflowInputs: string,
): ActionWorkflowInputs | undefined {
  if (workflowInputs === "") {
    return undefined;
  }

  try {
    const parsedJson = JSON.parse(workflowInputs);
    for (const key of Object.keys(parsedJson)) {
      const type = typeof parsedJson[key];
      if (!["string", "number", "boolean"].includes(type)) {
        throw new Error(
          `Expected value to be string, number, or boolean. "${key}" value is ${type}`,
        );
      }
    }
    return parsedJson;
  } catch (error) {
    core.error("Failed to parse workflow_inputs JSON");
    if (error instanceof Error) {
      error.stack && core.debug(error.stack);
    }
    throw error;
  }
}

function getWorkflowValue(workflowInput: string): string | number {
  try {
    // We can assume that the string is defined and not empty at this point.
    return getNumberFromValue(workflowInput)!;
  } catch {
    // Assume using a workflow name instead of an ID.
    return workflowInput;
  }
}
