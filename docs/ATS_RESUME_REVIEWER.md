# ATS Resume Reviewer (Phase 14)

Phase 14 extends the private Resume Library with database-backed versions, deterministic ATS analysis, target-keyword matching, version comparison, grounded Gemini improvement suggestions, and PDF/CSV reports. Stored PDFs and extracted text remain backend-only.

## Scoring model

The scores are explainable estimates, not claims about a specific vendor's ATS and not hiring predictions.

ATS score weights:

| Dimension | Weight | Evidence |
| --- | ---: | --- |
| Keyword match | 35% | Target role dictionary and/or supplied job-description terms found in extracted text |
| Structure | 25% | Contact details, skills, experience, education, projects, and professional links |
| Content | 25% | Useful length, measurable achievements, strong action verbs, and bullet usage |
| Readability | 15% | Average sentence length and word length |

The general Resume score excludes target keywords: structure 35%, content 40%, and readability 25%. Every component is clamped to 0-100. Missing skills are only reported when a supplied role/job criterion is absent from the resume; the application never claims the user has an unobserved skill.

## Versioning and ownership

- Every successful PDF upload is a new `Resume.version` for its JWT owner.
- Existing pre-Phase-14 resumes receive stable chronological version numbers automatically.
- The newest upload becomes active, while older versions remain available for comparison.
- `ResumeAnalysis` stores one cached analysis per owner, resume, and criteria hash.
- Job-description text is used for analysis but is not stored; only whether one was supplied and its criteria hash are persisted.
- Deleting a resume removes its stored PDF and all related ATS analyses.

## API

All routes require `Authorization: Bearer <token>`. Both the original `/api/resumes` routes and the Phase 14 `/api/resume` routes use the same controller/model architecture.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/resume/upload` | Upload, parse, version, activate, and baseline-score one PDF |
| `GET` | `/api/resume` | List owned resume versions and their latest analyses |
| `GET` | `/api/resume/history` | List owned database-backed versions |
| `GET` | `/api/resume/analysis?resumeId=&targetRole=` | Read/create an analysis without a job description |
| `POST` | `/api/resume/analysis` | Analyze with optional private job-description text |
| `POST` | `/api/resume/compare` | Compare 2-4 owned versions under the same criteria |
| `POST` | `/api/resume/improve` | Generate and store grounded Gemini suggestions |
| `POST` | `/api/resume/export` | Generate a PDF or CSV report |
| `GET` | `/api/resume/:id` | Load one owned resume's safe metadata |
| `PATCH` | `/api/resume/:id/active` | Select a version for interviews |
| `DELETE` | `/api/resume/:id` | Delete an owned version, file, and analyses |

Targeted analysis body:

```json
{
  "resumeId": "RESUME_OBJECT_ID",
  "targetRole": "Frontend Developer",
  "jobDescription": "Optional job description, maximum 12000 characters"
}
```

Comparison accepts `resumeIds` with 2-4 unique IDs. Export accepts `format` as `pdf` or `csv`. API responses keep the project's standard `{ success, message, data }` envelope.

## Manual testing

1. Open **Resumes** and upload a valid text-based PDF. Confirm version 1, an ATS score, and active status appear.
2. Upload an edited PDF. Confirm its version increments and both versions remain in history.
3. Enter a target role and job description, run the review, and inspect matched/missing keywords, missing skills, action verbs, issues, and score dimensions.
4. Generate AI suggestions and confirm examples use placeholders instead of invented experience or metrics.
5. Select two versions, compare them, and verify score changes and the recommended version.
6. Export PDF and CSV. Open the PDF and verify every page, header, footer, wrapping, and disclaimer; open CSV and confirm sections/escaping.
7. Switch System, Light, and Dark themes, then check desktop and mobile widths.
8. Sign in as another user and confirm direct access to the first user's IDs returns `403`.
9. Delete a version and verify its PDF and ATS records are removed.

## Known limitations

- ATS vendors use proprietary parsers and ranking rules, so the score cannot reproduce a specific employer's result.
- Scanned/image-only PDFs require OCR, which is not included; users receive the existing readable-text error.
- Keyword extraction is English-oriented and intentionally bounded to reduce noise.
- Version comparison evaluates parsed text and saved metadata, not visual layout differences between the original PDFs.
