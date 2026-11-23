# Sources of the translation texts

The translation eval uses 110 texts. Each text has an en, a pl, and a ru version. This file gives the source, the license, and the attribution of each kind of text. It also gives the changes that we made to the texts.

## Files

| File | Content |
|---|---|
| `data/originals.jsonl` | The 110 texts as the sources give them, after extraction and placeholder replacement. |
| `data/texts.jsonl` | The 110 changed texts that the eval uses. Each row gives its changes, its unexpected piece, and its source fixes. |
| `scripts/check-texts.ts` | Checks each changed text against its original. |
| `data/email-placeholders.json` | The fixed value of each Discourse placeholder. |
| `data/studies-pl-map.json` | The pl block of the whitepaper for each studies text. We aligned these blocks by hand. |
| `scripts/fetch-sources.sh` | Downloads the pinned sources into `.cache/`. |
| `scripts/collect.ts` | Extracts the candidates, draws the texts, and writes `data/originals.jsonl`. |

To make `data/originals.jsonl` again, run these commands in this folder:

```sh
./scripts/fetch-sources.sh
bun scripts/collect.ts
```

## Sources and licenses

| Kind | Texts | Source | Version | License | Attribution |
|---|---|---|---|---|---|
| speech | 20 | WMT24++, `speech` domain | `en-pl_PL.jsonl` and `en-ru_RU.jsonl`, SHA-256 in `scripts/sources.sha256` | Apache-2.0 | Google, WMT24++ (https://huggingface.co/datasets/google/wmt24pp) |
| news | 10 | WMT24++, `news` domain | Same files | Apache-2.0 | Google, WMT24++ |
| it-docs | 20 | Kubernetes documentation, `content/{en,pl,ru}/docs/` | `kubernetes/website` at `de0990c2ae787ea164cde35f28b0e027700301db` | CC-BY-4.0 | The Kubernetes Authors (https://github.com/kubernetes/website) |
| emails | 20 | Discourse server locales, `text_body_template` keys | `discourse/discourse` at `e077161ff34dca5e53cacb4e16430516143d3c67` | GPL-2.0 | Civilized Discourse Construction Kit, Inc. and the Discourse translators (https://github.com/discourse/discourse) |
| documents | 20 | Creative Commons Attribution 4.0 International legal code, en, pl, and ru | `https://creativecommons.org/licenses/by/4.0/legalcode`, SHA-256 in `scripts/sources.sha256` | CC0 | Creative Commons (https://creativecommons.org) |
| studies | 20 | Ethereum whitepaper on ethereum.org | `ethereum/ethereum-org-website` at `2d07fa79832ae6cc7346e0d6f0e912ffe4e66b11` (2025-12-17) | MIT | Vitalik Buterin and the ethereum.org contributors (https://github.com/ethereum/ethereum-org-website) |

The changed documents texts are not a Creative Commons license. Creative Commons does not endorse them.

## How the script selects the texts

A candidate is a text that has a version in en, pl, and ru, with 20 to 150 English words.

| Kind | Candidate rule | Candidates |
|---|---|---|
| speech, news | A WMT24++ row with the same `source` in the pl and the ru file, and no `is_bad_source` row. The reference is `target`. | 110, 121 |
| it-docs | A prose paragraph of a page that has an en, a pl, and a ru version with the same number of blocks. The paragraph has no Hugo shortcode. Its numbers and inline code agree in the 3 languages. | 61 |
| emails | A `text_body_template` that has an en, a pl, and a ru value. | 77, in 33 families |
| documents | The own text of one list item or paragraph of the legal code, with the same `id` in the 3 languages. | 40 |
| studies | A prose block of the en whitepaper, with the ru block at the same position. Their numbers and inline code agree. Italic editorial notes and figure captions are not candidates. | 60 |

- The script ranks the candidates of each kind by the SHA-256 of the seed `issue-21`, the kind, and the reference. It takes the candidates with the lowest ranks.
- Two emails are in one family when they share a line of 6 or more words, or when 60% or more of their distinct words are the same. The script takes a maximum of one email from each family.
- From the texts of each kind, the script marks 5 texts for an unexpected piece. It uses the same ranking with a different salt.

## How the script cleans the texts

- Markdown links keep their text and lose their URL, in the it-docs and studies texts. The emails keep their Markdown, because the emails are Markdown.
- HTML entities such as `&mdash;` become their characters.
- In the studies texts, `2<sup>187</sup>` becomes `2^187`. Each other superscript is a note mark, and the script removes it. The script also removes the backslash of escaped Markdown characters in the pl whitepaper.
- In the emails, the script replaces each placeholder with its value from `data/email-placeholders.json`. A name, a title, a URL, a number, or a code has one value for the 3 languages. Free text has one value for each language.

## Changes to the texts

We changed each text in all 3 languages, so that training data on the sources does not raise the scores. Claude Opus 5.5 drafted the changes. A person reviews all 110 texts in the 3 languages. The `changes` field of each row in `data/texts.jsonl` gives the changes of that text.

- In all 110 texts, names and numbers changed. Examples are people, places, companies, products, dates, counts, versions, and section numbers.
- When a text had no name or number to change, we added a short detail with a name or a number. For example, "Every cluster needs at least one worker node" became "Every cluster in the Bergen office needs at least three worker nodes".
- In 30 texts, 5 of each kind, we added one unexpected piece, for example "Your new account comes with a free goat." The `unexpected` field gives the en text of the piece.
- The rest of each text stays as the source gives it. We did not correct the translation faults of the sources.
- We corrected only mechanical faults, for example a `"` in place of an apostrophe. The `fixes` field, or the `changes` field, gives each correction.
- In the documents texts, "Public License" became "Alder Public License", and each section number went up by 1. The documents texts are not a Creative Commons license.
- In the emails, each email has its own invented site name, domain, user name, and codes. Discourse became the invented product Threadwell.

To check the changed texts, run this command in this folder:

```sh
bun scripts/check-texts.ts
```

## Known faults of the sources

- The pl and ru emails are service texts of unknown origin.
- The pl whitepaper has translation faults. Some sentences lose words, for example studies-02.
