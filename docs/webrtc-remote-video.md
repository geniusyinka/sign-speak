# Remote Video With WebRTC

This document describes the recommended path to evolve SignSpeak from a shared translated room into a true multi-user video call with remote video feeds.

## Current State

Today the app supports:

- local camera and microphone capture per participant
- room-based shared transcript sessions over the existing websocket backend
- participant presence states such as `idle`, `signing`, `speaking`, and `processing`

Today the app does **not** support:

- remote video playback from other participants
- remote raw audio playback between participants
- peer-to-peer media negotiation

## Goal

Add remote participant video tiles so people in the same room can see each other while preserving the AI translation pipeline already in place.

## Recommended Architecture

Use a hybrid model:

1. Keep the current websocket server for room state, transcript broadcast, and AI turn processing.
2. Add WebRTC signaling messages over the same websocket connection.
3. Use direct peer-to-peer media for camera and optional microphone streams.
4. Keep Gemini processing on the existing backend websocket path.

This avoids replacing the current product flow while adding remote media incrementally.

## Minimum WebRTC Scope

For the first working version:

- support 2 participants per room
- transmit remote video only
- keep remote microphone audio off by default to avoid echo and feedback
- continue using the existing translated transcript as the primary communication layer

This is the safest path for a demo.

## Signaling Messages

Add websocket message types such as:

- `webrtc_offer`
- `webrtc_answer`
- `webrtc_ice_candidate`
- `participant_joined`
- `participant_left`

Each message should include:

- `roomId`
- `fromParticipantId`
- `toParticipantId`
- payload fields specific to SDP or ICE

## Frontend Changes

The frontend needs:

- local `getUserMedia()` capture for a room session
- one `RTCPeerConnection` per remote participant
- remote video elements bound to received media tracks
- call tile layout for local and remote participants
- mute/camera state UI

Recommended component split:

- `RoomCallPanel`
- `RemoteParticipantTile`
- `useWebRTC`

## Backend Changes

The backend should remain a signaling relay only for WebRTC.

Needed work:

- forward offer/answer/candidate messages to the intended room participant
- keep participant join/leave events in sync
- do not proxy media through FastAPI

## Risks

- NAT traversal may fail without STUN/TURN
- microphone echo can degrade transcription quality
- multi-party meshes do not scale well
- reconnect behavior gets more complex

## Suggested Rollout

### Phase 1

- two-person room
- video only
- transcript remains the source of truth

### Phase 2

- optional remote audio
- richer participant states
- room reconnect handling

### Phase 3

- TURN infrastructure for reliability
- more than two participants

## Recommendation

Do not block the current demo on WebRTC implementation.

Ship the shared-room experience now, then add remote video as a clearly separated follow-up using websocket signaling plus peer-to-peer video transport.
