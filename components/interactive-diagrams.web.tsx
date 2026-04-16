import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'expo-router';
import { CSSProperties, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';

type DiagramId = 'Signal Mesh' | 'Ops Loop' | 'Release Pulse';

type DiagramNode = {
  id: string;
  label: string;
  caption: string;
  description: string;
  x: number;
  y: number;
  stat: string;
};

type DiagramDefinition = {
  id: DiagramId;
  eyebrow: string;
  title: string;
  description: string;
  accent: [string, string];
  nodes: DiagramNode[];
  edges: [string, string][];
  summary: string[];
};

const diagrams: DiagramDefinition[] = [
  {
    id: 'Signal Mesh',
    eyebrow: 'Realtime architecture',
    title: 'Signal Mesh',
    description:
      'A living map of how product events are captured, enriched, scored, and pushed into downstream action.',
    accent: ['#74D8FF', '#5F74FF'],
    summary: ['Ingestion stays visible', 'Identity joins are explicit', 'Rules can be inspected live'],
    nodes: [
      {
        id: 'capture',
        label: 'Capture',
        caption: 'Product touchpoints',
        description: 'Client interactions enter the pipeline through a bounded intake layer.',
        x: 16,
        y: 22,
        stat: '42k/min',
      },
      {
        id: 'profile',
        label: 'Profile',
        caption: 'Identity graph',
        description: 'Anonymous events are stitched into a profile model for segmentation and recall.',
        x: 38,
        y: 56,
        stat: '18 signals',
      },
      {
        id: 'rules',
        label: 'Rules',
        caption: 'Decision engine',
        description: 'Thresholds and business logic convert noisy traffic into targeted actions.',
        x: 68,
        y: 30,
        stat: '94% pass',
      },
      {
        id: 'notify',
        label: 'Notify',
        caption: 'Operator surface',
        description: 'Resolved signals are routed into alerting, routing, or user-facing workflows.',
        x: 84,
        y: 70,
        stat: '2.8s lag',
      },
    ],
    edges: [
      ['capture', 'profile'],
      ['profile', 'rules'],
      ['rules', 'notify'],
      ['capture', 'rules'],
    ],
  },
  {
    id: 'Ops Loop',
    eyebrow: 'Incident response',
    title: 'Ops Loop',
    description:
      'A tighter response loop for detection, triage, remediation, and review when the system starts drifting.',
    accent: ['#FFCC73', '#FF7B62'],
    summary: ['Detection leads the loop', 'Rollback remains first-class', 'Reviews close the circuit'],
    nodes: [
      {
        id: 'detect',
        label: 'Detect',
        caption: 'Telemetry watch',
        description: 'Dashboards and anomaly monitors surface the first sign that the envelope changed.',
        x: 18,
        y: 28,
        stat: '6 monitors',
      },
      {
        id: 'triage',
        label: 'Triage',
        caption: 'Incident lane',
        description: 'The incident thread collects scope, severity, and the first clear owner.',
        x: 42,
        y: 68,
        stat: '11 min',
      },
      {
        id: 'patch',
        label: 'Patch',
        caption: 'Release gate',
        description: 'Fixes move through a narrow rollout path with rollback still available.',
        x: 72,
        y: 34,
        stat: '3 checks',
      },
      {
        id: 'review',
        label: 'Review',
        caption: 'Playbook update',
        description: 'The team records what happened and turns the gap into a durable protocol.',
        x: 84,
        y: 76,
        stat: '1 brief',
      },
    ],
    edges: [
      ['detect', 'triage'],
      ['triage', 'patch'],
      ['patch', 'review'],
      ['review', 'detect'],
    ],
  },
  {
    id: 'Release Pulse',
    eyebrow: 'Delivery flow',
    title: 'Release Pulse',
    description:
      'A rollout diagram that keeps planning, build quality, validation, and expansion in one frame.',
    accent: ['#E6FF88', '#3FD686'],
    summary: ['Blast radius is visible', 'Validation blocks expansion', 'Measurement stays attached'],
    nodes: [
      {
        id: 'plan',
        label: 'Plan',
        caption: 'Scope frame',
        description: 'Success metrics and rollback conditions are defined before code starts moving.',
        x: 18,
        y: 30,
        stat: '4 goals',
      },
      {
        id: 'build',
        label: 'Build',
        caption: 'Delivery lane',
        description: 'The feature ships behind bounded flags and explicit environment controls.',
        x: 40,
        y: 64,
        stat: '7 tasks',
      },
      {
        id: 'validate',
        label: 'Validate',
        caption: 'Guardrail panel',
        description: 'Quality, adoption, and stability signals are checked before widening exposure.',
        x: 70,
        y: 30,
        stat: '12 gates',
      },
      {
        id: 'expand',
        label: 'Expand',
        caption: 'Exposure ramp',
        description: 'Healthy signals allow the rollout to move outward without losing observability.',
        x: 84,
        y: 72,
        stat: '35%',
      },
    ],
    edges: [
      ['plan', 'build'],
      ['build', 'validate'],
      ['validate', 'expand'],
      ['plan', 'validate'],
    ],
  },
];

const shellStyle: CSSProperties = {
  color: '#F5F0E8',
  minHeight: '100vh',
  overflow: 'hidden',
  position: 'relative',
};

const glassCard: CSSProperties = {
  backdropFilter: 'blur(18px)',
  background: 'rgba(10, 16, 24, 0.58)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 28,
  boxShadow: '0 28px 90px rgba(0, 0, 0, 0.22)',
};

function DiagramSelector({
  activeDiagram,
  onSelect,
}: {
  activeDiagram: DiagramId;
  onSelect: (diagram: DiagramDefinition) => void;
}) {
  return (
    <LayoutGroup id="diagram-selector">
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        }}>
        {diagrams.map((diagram) => {
          const active = diagram.id === activeDiagram;

          return (
            <button
              key={diagram.id}
              type="button"
              onClick={() => onSelect(diagram)}
              style={{
                ...glassCard,
                appearance: 'none',
                color: '#F5F0E8',
                cursor: 'pointer',
                overflow: 'hidden',
                padding: 0,
                position: 'relative',
                textAlign: 'left',
              }}>
              {active ? (
                <motion.span
                  layoutId="diagram-pill"
                  style={{
                    background: `linear-gradient(135deg, ${diagram.accent[0]}, ${diagram.accent[1]})`,
                    inset: 0,
                    opacity: 0.18,
                    position: 'absolute',
                  }}
                />
              ) : null}
              <div style={{ display: 'grid', gap: 8, padding: 18, position: 'relative' }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.2em',
                    opacity: 0.56,
                    textTransform: 'uppercase',
                  }}>
                  {diagram.eyebrow}
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, lineHeight: 1 }}>{diagram.title}</div>
                <div style={{ color: 'rgba(245, 240, 232, 0.72)', fontSize: 14 }}>{diagram.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function DiagramCanvas({
  activeDiagram,
  activeNodeId,
  setActiveNodeId,
  signalPower,
  liveMode,
}: {
  activeDiagram: DiagramDefinition;
  activeNodeId: string;
  setActiveNodeId: (nodeId: string) => void;
  signalPower: number;
  liveMode: boolean;
}) {
  const activeNode = activeDiagram.nodes.find((node) => node.id === activeNodeId) ?? activeDiagram.nodes[0];
  const reduceMotion = useReducedMotion();

  return (
    <div
      style={{
        ...glassCard,
        minHeight: 540,
        overflow: 'hidden',
        padding: 24,
        position: 'relative',
      }}>
      <div
        style={{
          background: `radial-gradient(circle at 20% 20%, ${activeDiagram.accent[0]}44, transparent 24%), radial-gradient(circle at 80% 30%, ${activeDiagram.accent[1]}44, transparent 28%), linear-gradient(180deg, rgba(7, 12, 19, 0.88), rgba(8, 14, 20, 0.96))`,
          borderRadius: 24,
          inset: 18,
          position: 'absolute',
        }}
      />
      <div style={{ display: 'grid', gap: 10, position: 'relative', zIndex: 2 }}>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
          }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.18em',
                opacity: 0.56,
                textTransform: 'uppercase',
              }}>
              Interactive diagrams
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 36 }}>{activeDiagram.title}</div>
          </div>
          <div
            style={{
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 999,
              display: 'inline-flex',
              gap: 12,
              padding: '10px 16px',
            }}>
            <span style={{ fontSize: 13, opacity: 0.68 }}>Signal power</span>
            <strong style={{ fontSize: 20 }}>{signalPower}</strong>
          </div>
        </div>
        <div style={{ color: 'rgba(245, 240, 232, 0.72)', maxWidth: 720 }}>{activeDiagram.description}</div>
      </div>

      <div style={{ inset: 0, position: 'absolute', zIndex: 1 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: '100%', width: '100%' }}>
          {activeDiagram.edges.map(([sourceId, targetId]) => {
            const source = activeDiagram.nodes.find((node) => node.id === sourceId);
            const target = activeDiagram.nodes.find((node) => node.id === targetId);
            const isActive = activeNode?.id === sourceId || activeNode?.id === targetId;

            if (!source || !target) {
              return null;
            }

            return (
              <motion.line
                key={`${sourceId}-${targetId}`}
                animate={
                  reduceMotion
                    ? { opacity: isActive ? 0.95 : 0.34 }
                    : {
                        opacity: isActive ? 0.95 : 0.34,
                        strokeDashoffset: liveMode && isActive ? [-36, 0] : 0,
                      }
                }
                transition={reduceMotion ? undefined : { duration: 1.4, ease: 'linear', repeat: Infinity }}
                style={{
                  stroke: isActive ? activeDiagram.accent[0] : 'rgba(255, 255, 255, 0.24)',
                  strokeDasharray: '5 7',
                  strokeLinecap: 'round',
                  strokeWidth: isActive ? 0.9 + signalPower * 0.1 : 0.5,
                }}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
              />
            );
          })}
        </svg>
      </div>

      {activeDiagram.nodes.map((node) => {
        const isActive = node.id === activeNodeId;
        const isAdjacent = activeDiagram.edges.some(
          ([sourceId, targetId]) =>
            (sourceId === activeNodeId && targetId === node.id) ||
            (targetId === activeNodeId && sourceId === node.id),
        );

        return (
          <motion.button
            key={node.id}
            type="button"
            onClick={() => setActiveNodeId(node.id)}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.99 }}
            animate={{
              boxShadow: isActive
                ? `0 20px 60px ${activeDiagram.accent[0]}40`
                : isAdjacent
                  ? '0 14px 40px rgba(255, 255, 255, 0.12)'
                  : '0 10px 24px rgba(0, 0, 0, 0.2)',
              scale: isActive ? 1.04 + signalPower * 0.02 : isAdjacent ? 1.01 : 1,
            }}
            style={{
              appearance: 'none',
              background: isActive
                ? `linear-gradient(135deg, ${activeDiagram.accent[0]}26, ${activeDiagram.accent[1]}26)`
                : 'rgba(8, 14, 21, 0.78)',
              border: `1px solid ${isActive ? `${activeDiagram.accent[0]}99` : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: 24,
              color: '#F5F0E8',
              cursor: 'pointer',
              display: 'grid',
              gap: 8,
              left: `${node.x}%`,
              maxWidth: 200,
              padding: 18,
              position: 'absolute',
              textAlign: 'left',
              top: `${node.y}%`,
              transform: 'translate(-50%, -50%)',
              width: 'min(200px, 30vw)',
              zIndex: 3,
            }}>
            <div
              style={{
                color: 'rgba(245, 240, 232, 0.55)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}>
              {node.caption}
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, lineHeight: 1 }}>{node.label}</div>
            <div style={{ color: 'rgba(245, 240, 232, 0.72)', fontSize: 14, lineHeight: 1.5 }}>{node.description}</div>
            <div
              style={{
                alignItems: 'center',
                display: 'inline-flex',
                gap: 8,
              }}>
              <span
                style={{
                  background: `linear-gradient(135deg, ${activeDiagram.accent[0]}, ${activeDiagram.accent[1]})`,
                  borderRadius: 999,
                  display: 'inline-flex',
                  height: 10,
                  width: 10,
                }}
              />
              <strong style={{ fontSize: 14 }}>{node.stat}</strong>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function DetailPanel({
  activeDiagram,
  activeNodeId,
  signalPower,
  liveMode,
  setSignalPower,
  setLiveMode,
}: {
  activeDiagram: DiagramDefinition;
  activeNodeId: string;
  signalPower: number;
  liveMode: boolean;
  setSignalPower: (power: number) => void;
  setLiveMode: (value: boolean) => void;
}) {
  const activeNode = activeDiagram.nodes.find((node) => node.id === activeNodeId) ?? activeDiagram.nodes[0];
  const activeEdges = activeDiagram.edges.filter(
    ([sourceId, targetId]) => sourceId === activeNode.id || targetId === activeNode.id,
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ ...glassCard, display: 'grid', gap: 12, padding: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', opacity: 0.56, textTransform: 'uppercase' }}>
          Focused node
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 30 }}>{activeNode.label}</div>
        <div style={{ color: 'rgba(245, 240, 232, 0.72)', lineHeight: 1.6 }}>{activeNode.description}</div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            display: 'grid',
            gap: 10,
            padding: 16,
          }}>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', opacity: 0.56, textTransform: 'uppercase' }}>
            Active paths
          </div>
          {activeEdges.map(([sourceId, targetId]) => (
            <div key={`${sourceId}-${targetId}`} style={{ fontSize: 14 }}>
              {sourceId} to {targetId}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...glassCard, display: 'grid', gap: 16, padding: 20 }}>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.18em', opacity: 0.56, textTransform: 'uppercase' }}>
              Playback
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 26 }}>Live topology</div>
          </div>
          <button
            type="button"
            onClick={() => setLiveMode(!liveMode)}
            style={{
              appearance: 'none',
              background: liveMode
                ? `linear-gradient(135deg, ${activeDiagram.accent[0]}, ${activeDiagram.accent[1]})`
                : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: 999,
              color: liveMode ? '#081018' : '#F5F0E8',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              padding: '12px 18px',
            }}>
            {liveMode ? 'Streaming' : 'Paused'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', opacity: 0.56, textTransform: 'uppercase' }}>
            Signal power
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[1, 2, 3].map((level) => {
              const active = level === signalPower;

              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSignalPower(level)}
                  style={{
                    appearance: 'none',
                    background: active
                      ? `linear-gradient(135deg, ${activeDiagram.accent[0]}, ${activeDiagram.accent[1]})`
                      : 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 999,
                    color: active ? '#081018' : '#F5F0E8',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    minWidth: 48,
                    padding: '10px 16px',
                  }}>
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ ...glassCard, display: 'grid', gap: 10, padding: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', opacity: 0.56, textTransform: 'uppercase' }}>
          Why this diagram works
        </div>
        {activeDiagram.summary.map((item) => (
          <div key={item} style={{ color: 'rgba(245, 240, 232, 0.78)', lineHeight: 1.5 }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InteractiveDiagrams() {
  const router = useRouter();
  const { currentUser, isHydrating, signOut } = useAuth();
  const reduceMotion = useReducedMotion();
  const [activeDiagramId, setActiveDiagramId] = useState<DiagramId>('Signal Mesh');
  const activeDiagram = diagrams.find((diagram) => diagram.id === activeDiagramId) ?? diagrams[0];
  const [activeNodeId, setActiveNodeId] = useState(activeDiagram.nodes[0]?.id ?? '');
  const [signalPower, setSignalPower] = useState(2);
  const [liveMode, setLiveMode] = useState(true);
  const sessionStatus = isHydrating
    ? 'Restoring session...'
    : currentUser
      ? `Signed in as ${currentUser.email}`
      : 'No active session.';

  return (
    <div
      style={{
        ...shellStyle,
        background:
          'radial-gradient(circle at top left, rgba(117, 216, 255, 0.2), transparent 26%), radial-gradient(circle at 84% 18%, rgba(255, 166, 109, 0.22), transparent 22%), linear-gradient(180deg, #06111A 0%, #0A141D 42%, #11141A 100%)',
      }}>
      <motion.div
        animate={reduceMotion ? undefined : { x: [0, 36, -18, 0], y: [0, 28, -22, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={reduceMotion ? undefined : { duration: 20, ease: 'easeInOut', repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(116, 216, 255, 0.28), transparent 66%)',
          height: 440,
          left: -120,
          pointerEvents: 'none',
          position: 'absolute',
          top: -140,
          width: 440,
        }}
      />
      <motion.div
        animate={reduceMotion ? undefined : { x: [0, -26, 18, 0], y: [0, -20, 24, 0], scale: [1, 0.94, 1.04, 1] }}
        transition={reduceMotion ? undefined : { duration: 24, ease: 'easeInOut', repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(255, 182, 112, 0.2), transparent 70%)',
          bottom: -180,
          height: 520,
          pointerEvents: 'none',
          position: 'absolute',
          right: -120,
          width: 520,
        }}
      />

      <main
        style={{
          margin: '0 auto',
          maxWidth: 1380,
          padding: '44px 24px 72px',
          position: 'relative',
          zIndex: 1,
        }}>
        <motion.section
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            ...glassCard,
            display: 'grid',
            gap: 18,
            marginBottom: 24,
            padding: 24,
          }}>
          <div
            style={{
              alignItems: 'start',
              display: 'grid',
              gap: 18,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ fontSize: 12, letterSpacing: '0.22em', opacity: 0.58, textTransform: 'uppercase' }}>
                Interactive diagrams
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(52px, 8vw, 104px)', lineHeight: 0.92 }}>
                Systems explained as a living canvas.
              </div>
              <div style={{ color: 'rgba(245, 240, 232, 0.74)', fontSize: 18, lineHeight: 1.7, maxWidth: 760 }}>
                This homepage now works like a diagram studio: switch blueprints, click nodes, and watch the
                topology respond without leaving the route.
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                display: 'grid',
                gap: 12,
                padding: 18,
              }}>
              <div style={{ fontSize: 12, letterSpacing: '0.18em', opacity: 0.56, textTransform: 'uppercase' }}>
                Authentication
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 28 }}>Session status</div>
              <div data-testid="session-status" style={{ color: 'rgba(245, 240, 232, 0.74)', lineHeight: 1.6 }}>
                {sessionStatus}
              </div>
              {currentUser ? (
                <button
                  type="button"
                  data-testid="signout-button"
                  onClick={signOut}
                  style={{
                    appearance: 'none',
                    background: '#972929',
                    border: 'none',
                    borderRadius: 999,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    justifySelf: 'start',
                    padding: '14px 18px',
                  }}>
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/auth/sign-in')}
                  style={{
                    appearance: 'none',
                    background: 'linear-gradient(135deg, #DDF9FF, #7ED7FF)',
                    border: 'none',
                    borderRadius: 999,
                    color: '#081018',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    justifySelf: 'start',
                    padding: '14px 18px',
                  }}>
                  Sign in
                </button>
              )}
            </div>
          </div>
        </motion.section>

        <section style={{ display: 'grid', gap: 20 }}>
          <DiagramSelector
            activeDiagram={activeDiagram.id}
            onSelect={(diagram) => {
              setActiveDiagramId(diagram.id);
              setActiveNodeId(diagram.nodes[0]?.id ?? '');
            }}
          />

          <div
            style={{
              alignItems: 'start',
              display: 'grid',
              gap: 20,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}>
            <DiagramCanvas
              activeDiagram={activeDiagram}
              activeNodeId={activeNodeId}
              setActiveNodeId={setActiveNodeId}
              signalPower={signalPower}
              liveMode={liveMode}
            />
            <DetailPanel
              activeDiagram={activeDiagram}
              activeNodeId={activeNodeId}
              signalPower={signalPower}
              liveMode={liveMode}
              setSignalPower={setSignalPower}
              setLiveMode={setLiveMode}
            />
          </div>
        </section>

        <AnimatePresence mode="wait">
          <motion.section
            key={activeDiagram.id}
            initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              marginTop: 24,
            }}>
            {activeDiagram.nodes.map((node) => (
              <div
                key={node.id}
                style={{
                  ...glassCard,
                  display: 'grid',
                  gap: 8,
                  padding: 18,
                }}>
                <div style={{ fontSize: 12, letterSpacing: '0.16em', opacity: 0.56, textTransform: 'uppercase' }}>
                  {node.caption}
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 28 }}>{node.label}</div>
                <div style={{ color: 'rgba(245, 240, 232, 0.72)', lineHeight: 1.6 }}>{node.description}</div>
              </div>
            ))}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}
