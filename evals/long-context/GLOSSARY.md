# Long-context

The long-context topic tests how a model finds and connects facts in a long prompt. It holds 5 tasks at 4 fill levels.

## Language

### Fill levels

**Standard window**:
The window of 131,072 tokens that the fill levels refer to. The standard window is the same for each model.
_Avoid_: max context, context length

**Fill level**:
One of the 4 sample lengths: 32,768, 65,536, 98,304, and 131,072 tokens. These lengths are 25%, 50%, 75%, and 100% of the standard window.
_Avoid_: bin, bucket, context size

**Native maximum**:
The largest number of tokens that a model reads with no RoPE scaling and no YaRN scaling.
_Avoid_: advertised maximum, trained length

**Output reserve**:
The 8,192 tokens of each fill level that stay free for the reasoning and the answer of the model.
_Avoid_: output budget, max tokens

**Prompt limit**:
A fill level minus the output reserve. The prompt of a sample is never longer than the prompt limit.

### Samples

**Task**:
One of the 5 kinds of sample in the topic: keyed retrieval, latent retrieval, variable tracking, fact chain, and coreference.
_Avoid_: test, eval

**Sample**:
One prompt of a task at one fill level, and the gold answer of that prompt.
_Avoid_: case, test case, item

**Haystack**:
The long text of a sample. The haystack hides the needles.
_Avoid_: document, context

**Filler**:
The book text from PG19 that fills the haystack around the needles.
_Avoid_: noise, padding

**Needle**:
One fact that a sample hides in the haystack. A fact chain sample hides 2 or 3 needles that connect.
_Avoid_: key fact, hidden fact

**Latent needle**:
A needle that has no word in common with its question. For example, the needle names the Semper Opera House, and the question names Dresden.

**Depth**:
The distance of a needle from the start of the haystack, as a percentage of the haystack: 10, 30, 50, 70, or 90.
_Avoid_: placement, position

### The 5 tasks

**Keyed retrieval**:
A task where the haystack has one key and distractor keys. The model gives the values of that one key. The design comes from RULER `niah_multikey`.

**Latent retrieval**:
A task where the model finds a latent needle. The model goes from the question to the needle in one hop or in two hops. The design comes from NoLiMa. We wrote our own needles.

**Variable tracking**:
A task where the model follows chains of variable assignments. Then the model names each variable that has the value that the question gives. The design comes from RULER `vt`.

**Fact chain**:
A task where the model connects 2 or 3 needles in the haystack to answer one question. The design comes from BABILong `qa2` and `qa3`.

**Coreference**:
A task where the model repeats one earlier reply from a long chat that has similar requests. Each sample comes from OpenAI MRCR and has 2 needles.
_Avoid_: MRCR task

### Results

**Reasoning mode**:
The thinking setting of a model for all samples of one run, for example off, low, or high.
_Avoid_: thinking budget, effort

**No answer**:
The result of a sample where the model used the full output reserve and gave no final answer.
_Avoid_: truncation

**Error**:
The result of a sample with no response from the server, for example after a timeout. An error is not a wrong answer.
_Avoid_: failure
