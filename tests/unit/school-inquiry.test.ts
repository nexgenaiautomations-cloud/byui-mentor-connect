import { describe, it, expect } from "vitest";
import { schoolInquirySchema, renderSchoolInquiryEmail } from "@/lib/school-inquiry";

const valid = {
  contactName: "Pat Example",
  contactEmail: "pat@state.edu",
  schoolName: "State University",
  role: "Career services director",
  emailDomain: "state.edu",
  message: "We'd like to offer ICAN to our students.",
};

describe("schoolInquirySchema", () => {
  it("accepts a complete inquiry", () => {
    expect(schoolInquirySchema.safeParse(valid).success).toBe(true);
  });

  it("requires name, email and school", () => {
    for (const key of ["contactName", "contactEmail", "schoolName"] as const) {
      expect(schoolInquirySchema.safeParse({ ...valid, [key]: "" }).success).toBe(false);
    }
  });

  it("allows role, domain and message to be blank", () => {
    const r = schoolInquirySchema.safeParse({ ...valid, role: "", emailDomain: "", message: "" });
    expect(r.success).toBe(true);
  });

  it("caps the message length", () => {
    expect(schoolInquirySchema.safeParse({ ...valid, message: "x".repeat(3001) }).success).toBe(false);
  });

  it("rejects a honeypot value", () => {
    expect(schoolInquirySchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
});

describe("renderSchoolInquiryEmail", () => {
  it("escapes HTML from the public form", () => {
    const { html, text } = renderSchoolInquiryEmail({
      ...valid,
      schoolName: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(text).toContain("<img src=x");
  });

  it("names the school in the subject", () => {
    expect(renderSchoolInquiryEmail(valid).subject).toContain("State University");
  });
});
