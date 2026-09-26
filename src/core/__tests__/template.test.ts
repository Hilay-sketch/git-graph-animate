import {
  templateExtend,
  TemplateName,
  metroTemplate,
  Template,
} from "../template.js";

describe("templateExtend", () => {
  it("should return the given template if we pass no new options", () => {
    const extendedTemplate = templateExtend(TemplateName.Metro, {});

    expect(extendedTemplate).toEqual(metroTemplate);
  });

  it("should extend the given template with options", () => {
    const options = {
      colors: ["red", "green", "blue"],
      branch: {
        lineWidth: 20,
      },
      commit: {
        message: {
          displayAuthor: false,
        },
      },
    };

    const extendedTemplate = templateExtend(TemplateName.Metro, options);

    const expectedTemplate = expect.objectContaining({
      colors: ["red", "green", "blue"],
      branch: expect.objectContaining({
        lineWidth: 20,
        spacing: 50, // from original Metro template
      }),
      commit: expect.objectContaining({
        message: expect.objectContaining({
          displayAuthor: false,
          displayHash: true, // from original Metro template
        }),
      }),
    });
    expect(extendedTemplate).toEqual(expectedTemplate);
  });

  it("should not change the given options", () => {
    const options = { branch: {}, commit: {} };

    new Template(options);
    templateExtend(TemplateName.Metro, options);

    expect(options).toEqual({ branch: {}, commit: {} });
  });
});
