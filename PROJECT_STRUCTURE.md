# Deutschly project structure

This project preserves the existing Deutschly/VocabularyApp application and adds a reusable learning architecture.

## Added modules

- `components/common`: reusable flashcard, quiz, progress and timer UI.
- `components/learning`: vocabulary form/list, category filter and mistake review.
- `services`: shared vocabulary/review logic and server-proxied AI client.
- `hooks`: study sessions, spaced repetition and IndexedDB vocabulary state.
- `utils/studyActivity.js`: local-date study activity tracking (separate from legacy createdAt data).
- `pages/AITutorPage.jsx`: AI tutor screen component.

## Integration notes

The existing pages and app routing are intentionally preserved to avoid breaking current user workflows. The new AITutorPage is scaffolded but is not automatically added to the sidebar/router; connect it to the app navigation after choosing the desired menu placement.

The AI client expects a server endpoint at `/api/ai/tutor` (or `VITE_AI_API_URL`). Implement that endpoint on a backend/serverless host and keep provider API keys there. Do not put secrets in `VITE_*` variables.

## Run

```bash
npm install
npm run dev
npm run build
```

## Data safety

The new study activity store uses `deutschly_study_activity_v1` in localStorage and does not rewrite or migrate existing vocabulary records. Existing IndexedDB stores, keys, backup files and Android project files are retained.
