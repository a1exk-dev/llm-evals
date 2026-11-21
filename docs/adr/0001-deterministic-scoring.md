# Each score comes from code, with no judge model

Code makes each score in each topic. No judge model makes a score, because a judge model can make a wrong decision, and the Operator does not trust its scores. A fixed metric model, for example COMET for translation, can only add an extra column next to the score.

## Consequences

- Each open-ended task has a checklist in code, for example "the reply is in German" or "the reply names the meeting date". The Opus 5.5 answer is only a sample that helps a person write and test the checklist.
- Benchmarks that use a judge for their published scores, for example SimpleQA Verified, need a different method. Our scores do not compare with published leaderboard scores.
- Translation uses chrF++ as the score.
