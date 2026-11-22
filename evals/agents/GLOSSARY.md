# Agents

The agents topic tests how a model uses tools. It holds the BFCL benchmark for single tool calls, and our own multi-step pipelines on a mock office.

## Language

### Pipelines and cases

**Pipeline**:
A multi-step task that the model does in one agent loop with the tools of the mock office. The model selects the sequence of its tool calls.
_Avoid_: workflow, chain, scenario

**Step**:
One part of a pipeline, for example the translation of an email. Each step has its own checks.
_Avoid_: stage, phase

**Case**:
One input of a pipeline: the start state of the mock office, the first message, and the gold value of each check.
_Avoid_: sample, test case, scenario

**Mock office**:
The fake mailbox, calendar, contacts, files, and order database that the tools of a pipeline read and change.
_Avoid_: sandbox, environment

**End state**:
The data of the mock office at the time when a case stops.

**Check**:
Code that compares a gold value with the value from the model. Each check gives pass or fail.
_Avoid_: assertion, test

**Checklist**:
The checks for the free text of one step, for example "the reply is in Polish" or "the translation names 14 March".

**Forbidden call**:
A tool call that a case does not permit, for example `open_link` on a phishing email.

**Trap case**:
A case where the correct action is to stop or to refuse, for example a refund request outside the policy.
_Avoid_: negative case, adversarial case

**Scripted customer**:
Code that gives fixed answers to fixed questions in a support desk case. No model acts as the customer.
_Avoid_: user simulator, model customer

### The 6 pipelines

**Inbox triage**:
A pipeline in English. The model gives each inbox email an email class and a priority level, and sorts the inbox.

**Email reply**:
A pipeline in the 12 directions between en, de, pl, and ru. The model translates one email and drafts a reply.

**Scheduling**:
A pipeline in English. The model reads a meeting request, finds a free time in the calendar, adds the event, and drafts a confirmation.

**Docs answer**:
A pipeline in English. The model searches the files of the mock office and answers a question. The answer also gives the names of the files that the model used.

**Support desk**:
A pipeline in English. The model looks up an order, applies the written policy, acts, and replies to the customer.

**Meeting notes**:
A pipeline in English. The model reads a transcript, finds the participants, and writes a summary and the action items.

### Emails

**Email class**:
The kind of an email: phishing, spam, or legitimate.
_Avoid_: label, category

**Priority level**:
The urgency of an email: high, normal, or low.

**Priority rules**:
The written rules in the system prompt that give each email one gold priority level.

**Gold pair**:
Two emails of an Inbox triage case where the first email must come before the second email in the sequence that the model gives.

**Email language**:
The language of the email that the model translates. The reply also uses the email language.

**User language**:
The language of the user. The user reads the translation and gives the reply intent in the user language.

**Reply intent**:
The instruction of the user for the text of the reply, for example "accept the meeting on Tuesday".

### Meetings

**Transcript**:
The text of one meeting. In a labelled transcript, each line starts with the first name of the participant.

**Participant**:
A person who speaks in the meeting, matched to one contact.

**Action item**:
A task from the meeting. Each action item has an owner, and also a due date when the transcript gives a due date.
