import { describe, it, expect } from "vitest";
import { parseResume } from "./resume-parser";

function cv(body: string) {
  return Buffer.from(body.trim(), "utf-8");
}

describe("parseResume (text/plain)", () => {
  it("extracts name, email, and skills from a simple CV", async () => {
    const parsed = await parseResume(
      cv(`
Jane Smith
jane.smith@example.com
+1 415-555-0100

Summary
Product manager with 10 years experience.

Skills
Python, SQL, Agile
`),
      "text/plain"
    );

    expect(parsed.firstName).toBe("Jane");
    expect(parsed.lastName).toBe("Smith");
    expect(parsed.email).toBe("jane.smith@example.com");
    expect(parsed.phone).toMatch(/415/);
    expect(parsed.skills.map((s) => s.toLowerCase())).toContain("python");
  });

  it("skips skill-like first line and uses real name on the next line", async () => {
    const parsed = await parseResume(
      cv(`
React TypeScript Node
Priya Nair
priya@example.com

Experience
Engineer at Acme
`),
      "text/plain"
    );

    expect(parsed.firstName).toBe("Priya");
    expect(parsed.lastName).toBe("Nair");
    expect(parsed.email).toBe("priya@example.com");
  });

  it("rejects headline as name when role tokens appear", async () => {
    const parsed = await parseResume(
      cv(`
Senior Software Engineer
Alex Lee
alex@example.com
`),
      "text/plain"
    );

    expect(parsed.firstName).toBe("Alex");
    expect(parsed.lastName).toBe("Lee");
  });

  it("does not treat a four-digit year range as a phone", async () => {
    const parsed = await parseResume(
      cv(`
Jane Doe
Honors
Best Paper 2022-2023
Phone +1 415-555-0199
`),
      "text/plain"
    );
    expect(parsed.phone).toContain("415");
    expect(parsed.phone).not.toContain("2022");
  });

  it("captures summary through Experience section when present", async () => {
    const parsed = await parseResume(
      cv(`
Summary
First paragraph about work.
Second paragraph continues here with more detail.

Experience
Acme Corp
Engineer
`),
      "text/plain"
    );
    expect(parsed.summary).toContain("First paragraph");
    expect(parsed.summary).toContain("Second paragraph");
    expect(parsed.summary).not.toMatch(/Experience/i);
  });

  it("extracts LinkedIn PDF layout: name line above headline with @", async () => {
    const parsed = await parseResume(
      cv(`
Contact
www.linkedin.com/in/example
Top Skills
Python
Mahesh Balan Umaithanu, PhD
AI @ Walmart | Ex-Acme
Chennai, Tamil Nadu, India
Summary
Principal Data Scientist.
`),
      "text/plain"
    );

    expect(parsed.fullName).toBe("Mahesh Balan Umaithanu");
    expect(parsed.firstName).toBe("Mahesh");
  });

  it("extracts LinkedIn-style experience (company, optional tenure, title, dates, multi-role)", async () => {
    const parsed = await parseResume(
      cv(`
Summary
Short.

Experience
Walmart Global Tech India
Principal Data Scientist - AI/ML
July 2025 - Present (10 months)
Chennai
Leading the development platform.

PayPal
4 years 7 months
Manager II, Machine Learning
April 2023 - July 2025 (2 years 4 months)
Chennai
Manager I, Machine Learning
January 2021 - March 2023 (2 years 3 months)

Education
Anna University
Bachelor of Engineering - BE
Engineering · (2008 - 2012)
`),
      "text/plain"
    );

    expect(parsed.experience.length).toBeGreaterThanOrEqual(3);
    const titles = parsed.experience.map((e) => e.title);
    expect(titles.some((t) => /Principal Data Scientist/i.test(t))).toBe(true);
    expect(titles.some((t) => /Manager II/i.test(t))).toBe(true);
    expect(titles.some((t) => /Manager I/i.test(t))).toBe(true);
    expect(parsed.experience[0].duration).toMatch(/July 2025/i);

    expect(parsed.education.length).toBeGreaterThanOrEqual(1);
    expect(parsed.education[0].institution).toMatch(/Anna University/i);
    expect(parsed.education[0].degree).toMatch(/Bachelor of Engineering/i);
    expect(parsed.education[0].degree).toMatch(/2008/i);
  });

  it("extracts LinkedIn visiting faculty blocks and institution continuations", async () => {
    const parsed = await parseResume(
      cv(`
Experience
Visiting Faculty - AI/ML
5 years 5 months
IIT Madras
April 2021 - Present (5 years 1 month)
Batch: Online BS
IIM Lucknow
February 2022 - Present (4 years 3 months)
Courses: Machine Learning

PayPal
Engineer
Jan 2020 - Jan 2021 (1 year)
Remote
Education
IIIT Example
B.Tech · (2015 - 2019)
`),
      "text/plain"
    );

    expect(parsed.experience.some((e) => /Visiting Faculty/i.test(e.title) && /IIT Madras/i.test(e.company))).toBe(
      true
    );
    expect(parsed.experience.some((e) => /Visiting Faculty/i.test(e.title) && /IIM Lucknow/i.test(e.company))).toBe(
      true
    );
    expect(parsed.experience.some((e) => e.company === "PayPal")).toBe(true);
  });
});
