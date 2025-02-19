import { describe, expect, it } from "vitest";

import { getBranchName } from "./utils";

describe("utils", () => {
  describe("getBranchNameFromRef", () => {
    it("should return the branch name for a valid branch ref", () => {
      const branchName = "cool_feature";
      const ref = `/refs/heads/${branchName}`;
      const branch = getBranchName(ref);

      expect(branch).toStrictEqual(branchName);
    });

    it("should return the branch name for a valid branch ref without a leading slash", () => {
      const branchName = "cool_feature";
      const ref = `refs/heads/${branchName}`;
      const branch = getBranchName(ref);

      expect(branch).toStrictEqual(branchName);
    });

    it("should return undefined for an invalid branch ref", () => {
      const branch = getBranchName("refs/heads/");

      expect(branch).toBeUndefined();
    });

    it("should return undefined if the ref is for a tag", () => {
      const branch = getBranchName("refs/tags/v1.0.1");

      expect(branch).toBeUndefined();
    });

    it("should return undefined if the ref is for an invalid tag", () => {
      const branch = getBranchName("refs/tags/");

      expect(branch).toBeUndefined();
    });
  });
});
