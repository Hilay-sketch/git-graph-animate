import * as utils from "../utils.js";

describe("utils", () => {
  describe("withoutUndefinedKeys", () => {
    it("should remove undefined keys", () => {
      const actual = utils.withoutUndefinedKeys({ a: 1, b: undefined, c: "3" });
      const expected = {
        a: 1,
        c: "3",
      };

      expect(actual).toEqual(expected);
    });
  });
});
