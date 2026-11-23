import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { buildApp } from '../app';

describe('Milestone 18: Collaborative Study Rooms & WebRTC Interactive Whiteboard Engine', () => {
  let app: FastifyInstance;
  let serverPort: number;
  const runId = Date.now();
  const hostEmail = `study.host.${runId}@test.com`;
  const peerEmail = `study.peer.${runId}@test.com`;
  const intruderEmail = `study.intruder.${runId}@test.com`;

  let hostCookie: string;
  let intruderCookie: string;
  let hostUserId: string;
  let peerUserId: string;

  let quizId: string;
  let createdRoomId: string;
  let createdRoomCode: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };
    serverPort = address.port;

    // 1. Register host
    const hostRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: hostEmail,
        password: 'Password123!',
        displayName: 'Professor Marie Curie',
        role: 'teacher',
      },
    });
    expect(hostRes.statusCode).toBe(201);
    const hostCookieHeader = hostRes.headers['set-cookie'];
    hostCookie = Array.isArray(hostCookieHeader) ? hostCookieHeader[0]! : (hostCookieHeader as string);
    const hostData = JSON.parse(hostRes.payload);
    hostUserId = hostData.data.user.id;

    // 2. Register peer
    const peerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: peerEmail,
        password: 'Password123!',
        displayName: 'Pierre Curie',
      },
    });
    expect(peerRes.statusCode).toBe(201);
    const peerData = JSON.parse(peerRes.payload);
    peerUserId = peerData.data.user.id;

    // 3. Register intruder
    const intruderRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: intruderEmail,
        password: 'Password123!',
        displayName: 'Becquerel',
      },
    });
    expect(intruderRes.statusCode).toBe(201);
    const intCookieHeader = intruderRes.headers['set-cookie'];
    intruderCookie = Array.isArray(intCookieHeader) ? intCookieHeader[0]! : (intCookieHeader as string);

    // 4. Create a sample quiz to link
    const quizRes = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: hostCookie },
      payload: {
        topic: 'Nuclear Physics & Radioactivity',
        questionCount: 3,
        difficulty: 'medium',
      },
    });
    expect(quizRes.statusCode).toBe(201);
    const quizData = JSON.parse(quizRes.payload);
    quizId = quizData.data.quizId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated room creation (401 Unauthorized)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/study-rooms',
      payload: {
        title: 'Quantum Mechanics Lab',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('validates study room input schema (400 Bad Request)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/study-rooms',
      headers: { cookie: hostCookie },
      payload: {
        title: 'Q', // too short (< 2 chars)
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates an active study room linked to a quiz with 6-char room code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/study-rooms',
      headers: { cookie: hostCookie },
      payload: {
        title: 'Radioactivity & Particle Physics Workshop',
        quizId,
        maxParticipants: 12,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.code).toHaveLength(6);
    expect(body.data.title).toBe('Radioactivity & Particle Physics Workshop');
    expect(body.data.status).toBe('active');
    expect(body.data.quizId).toBe(quizId);
    expect(body.data.quizTitle).toBe('Nuclear Physics & Radioactivity');

    createdRoomId = body.data.id;
    createdRoomCode = body.data.code;
  });

  it('retrieves active study rooms list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/study-rooms/active',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((r: any) => r.id === createdRoomId);
    expect(found).toBeDefined();
    expect(found.code).toBe(createdRoomCode);
    expect(found.hostName).toBe('Professor Marie Curie');
  });

  it('retrieves room details by 6-char code including linked questions and choices', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/study-rooms/${createdRoomCode}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdRoomId);
    expect(body.data.quizData).toBeDefined();
    expect(body.data.quizData.questions.length).toBeGreaterThanOrEqual(1);
    expect(body.data.quizData.questions[0].choices.length).toBeGreaterThanOrEqual(2);
  });

  it('handles real-time multi-peer WebSocket interaction (strokes, chat, cursors, questions, webrtc relay)', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}/api/study-rooms/ws`;

    // Connect Host (Marie)
    const hostWs = new WebSocket(wsUrl);
    const hostReceived: any[] = [];
    hostWs.on('message', (data) => {
      hostReceived.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve, reject) => {
      hostWs.on('open', () => resolve());
      hostWs.on('error', (err) => reject(err));
    });

    // Host joins room
    hostWs.send(
      JSON.stringify({
        type: 'JOIN_ROOM',
        roomIdOrCode: createdRoomCode,
        userId: hostUserId,
        userName: 'Professor Marie Curie',
      })
    );

    // Wait for ROOM_STATE
    await new Promise((r) => setTimeout(r, 200));
    expect(hostReceived.some((m) => m.type === 'ROOM_STATE')).toBe(true);

    // Connect Peer (Pierre)
    const peerWs = new WebSocket(wsUrl);
    const peerReceived: any[] = [];
    peerWs.on('message', (data) => {
      peerReceived.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve, reject) => {
      peerWs.on('open', () => resolve());
      peerWs.on('error', (err) => reject(err));
    });

    // Peer joins room
    peerWs.send(
      JSON.stringify({
        type: 'JOIN_ROOM',
        roomIdOrCode: createdRoomId,
        userId: peerUserId,
        userName: 'Pierre Curie',
      })
    );

    await new Promise((r) => setTimeout(r, 200));

    // Marie should receive PARTICIPANT_JOINED
    expect(hostReceived.some((m) => m.type === 'PARTICIPANT_JOINED' && m.participant.userId === peerUserId)).toBe(true);

    // Marie draws a stroke on the whiteboard
    const sampleStroke = {
      id: 'stroke-1',
      tool: 'pen',
      color: '#1935CA',
      size: 4,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.4 },
      ],
      userId: hostUserId,
      userName: 'Professor Marie Curie',
    };

    hostWs.send(
      JSON.stringify({
        type: 'WB_STROKE',
        roomId: createdRoomId,
        stroke: sampleStroke,
      })
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(peerReceived.some((m) => m.type === 'WB_STROKE_BROADCAST' && m.stroke.id === 'stroke-1')).toBe(true);

    // Pierre moves cursor
    peerWs.send(
      JSON.stringify({
        type: 'WB_CURSOR',
        roomId: createdRoomId,
        x: 0.55,
        y: 0.65,
      })
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(hostReceived.some((m) => m.type === 'WB_CURSOR_BROADCAST' && m.userId === peerUserId)).toBe(true);

    // Host navigates to question 1
    hostWs.send(
      JSON.stringify({
        type: 'SELECT_QUESTION',
        roomId: createdRoomId,
        questionIndex: 1,
      })
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(peerReceived.some((m) => m.type === 'QUESTION_SYNC' && m.questionIndex === 1)).toBe(true);

    // Peer sends a chat message
    peerWs.send(
      JSON.stringify({
        type: 'CHAT_MESSAGE',
        roomId: createdRoomId,
        text: 'The alpha decay equation is balanced!',
      })
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(
      hostReceived.some(
        (m) => m.type === 'CHAT_BROADCAST' && m.message.text.includes('alpha decay equation')
      )
    ).toBe(true);

    // Peer sends WebRTC signaling offer targeting Host
    peerWs.send(
      JSON.stringify({
        type: 'WEBRTC_SIGNAL',
        roomId: createdRoomId,
        targetUserId: hostUserId,
        signal: { type: 'offer', sdp: 'v=0\r\no=peer 1234 2 IN IP4 127.0.0.1' },
      })
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(
      hostReceived.some(
        (m) =>
          m.type === 'WEBRTC_SIGNAL_FORWARD' &&
          m.fromUserId === peerUserId &&
          m.signal.type === 'offer'
      )
    ).toBe(true);

    // Pierre raises hand
    peerWs.send(
      JSON.stringify({
        type: 'TOGGLE_HAND',
        roomId: createdRoomId,
        raised: true,
      })
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(
      hostReceived.some(
        (m) =>
          m.type === 'PARTICIPANT_UPDATE' &&
          m.participant.userId === peerUserId &&
          m.participant.isHandRaised === true
      )
    ).toBe(true);

    // Host clears whiteboard
    hostWs.send(
      JSON.stringify({
        type: 'WB_CLEAR',
        roomId: createdRoomId,
      })
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(peerReceived.some((m) => m.type === 'WB_CLEAR_BROADCAST')).toBe(true);

    // Peer disconnects
    peerWs.close();
    await new Promise((r) => setTimeout(r, 200));
    expect(hostReceived.some((m) => m.type === 'PARTICIPANT_LEFT' && m.userId === peerUserId)).toBe(true);

    hostWs.close();
  });

  it('prevents non-hosts from ending the study room (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/study-rooms/${createdRoomId}/end`,
      headers: { cookie: intruderCookie },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('allows host to end the study room successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/study-rooms/${createdRoomId}/end`,
      headers: { cookie: hostCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ended');
    expect(body.data.endedAt).toBeDefined();

    // Verify it no longer appears in active rooms
    const activeRes = await app.inject({
      method: 'GET',
      url: '/api/study-rooms/active',
    });
    const activeBody = JSON.parse(activeRes.payload);
    expect(activeBody.data.some((r: any) => r.id === createdRoomId)).toBe(false);
  });
});
