# SignSpeak Demo Script

## Main Script

Hi, I’m Yinka, and this is SignSpeak.

SignSpeak is a real-time communication tool designed to help Deaf or hard-of-hearing signers and hearing speakers talk more naturally, using live sign recognition, speech transcription, and AI-assisted turn interpretation.

The core problem we focused on was not just “can AI recognize a sign,” but “can AI recognize a sign at the right moment.”

That became our biggest architectural decision.

Most simple sign-recognition demos treat signing like image classification: they grab a frame, guess the sign, and move on. But real signing is not a collection of isolated snapshots. Meaning lives across motion, timing, transitions, and phrase boundaries.

So instead of interpreting every frame independently, we designed SignSpeak around a phrase-based capture model.

Our system watches for a natural start and stop signal in signing:
when the hands come up, we begin collecting frames,
and when the hands go down, we treat that like punctuation at the end of a sentence or phrase.

That hands-up and hands-down behavior became our version of turn segmentation.

You can think of it like reverse-engineering punctuation from body language.
In written language, periods and commas tell you where meaning units begin and end.
In signing, we used hand presence and motion patterns to approximate that boundary in real time.

That one decision changed the whole product.

It let us stop sending isolated snapshots and instead send a coherent sequence of frames to Gemini.
That improved accuracy, reduced overconfident single-frame guesses, and made the interaction feel much more natural.

On the backend, we use Gemini to reason over short multimodal frame sequences for sign interpretation, and to transcribe spoken audio in the other direction.
We also preserve recent conversation history, so short replies and ambiguous signs can be interpreted in context instead of in isolation.

On the frontend, the browser captures the webcam and microphone in real time.
For sign input, we buffer a rolling phrase clip rather than a single image.
For speech input, we stream audio chunks and return fast transcription updates.
The result is a two-way experience where both participants can follow the conversation live.

Let me show it working.

First, in signing mode, the signer raises their hands and signs a phrase.
As the hands stay up, SignSpeak keeps collecting frames.
When the hands drop, the system interprets the full segment and returns a translation.

Now in listening mode, the hearing participant speaks, and SignSpeak transcribes that speech in real time so the Deaf user can read it immediately.

We also extended the experience into shared rooms, so multiple participants can join the same live translated conversation space without needing a full custom call stack.
That let us stay focused on what mattered most for this hackathon: the intelligence of the interaction itself.

So the main insight behind SignSpeak is simple:
communication quality does not come only from model choice.
It also comes from deciding exactly when the model should pay attention.

By treating hand movement like punctuation, and phrases like units of meaning, we built a system that is more accurate, more usable, and much closer to how real conversations actually happen.

This is SignSpeak. Thank you.

## Shorter Punchier Version

If you want a more energetic version, use this line near the middle:

“The breakthrough for us was realizing that sign language needs punctuation too. Since signing doesn’t come with periods on screen, we inferred punctuation from motion: hands up means a phrase is in progress, hands down means it’s time to interpret.”

## Good Judge-Bait Lines

- “We didn’t optimize for frame recognition. We optimized for conversational timing.”
- “Our biggest innovation was not just model usage, but turn segmentation.”
- “We translated body language into punctuation.”
- “Instead of asking AI to guess from a snapshot, we gave it a complete thought.”
- “The product got better when we stopped treating signing like static vision and started treating it like language.”

## Suggested Demo Flow

1. 15 sec intro
2. 30 sec problem framing
3. 45 sec architectural insight: hands-up/hands-down as punctuation
4. 60 sec live signing demo
5. 30 sec speech-to-text demo
6. 20 sec shared room mention
7. 20 sec close

## Optional Follow-Ups

This can also be adapted into:

- a polished 90-second version
- a more hype hackathon-pitch version
- a shot-by-shot script with what to show on screen at each line
