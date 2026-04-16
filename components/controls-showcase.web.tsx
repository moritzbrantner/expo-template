import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { CSSProperties, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';

type Suite = 'Lumen' | 'Cascade' | 'Velour';
type Tone = 'Dawn' | 'Nocturne' | 'Citrus';

const suites: { id: Suite; label: string; blurb: string }[] = [
  { id: 'Lumen', label: 'Lumen', blurb: 'Bright, glassy response with crisp edge highlights.' },
  { id: 'Cascade', label: 'Cascade', blurb: 'Layered transitions with a softer bloom trail.' },
  { id: 'Velour', label: 'Velour', blurb: 'Dense, plush motion with richer shadows and depth.' },
];

const tones: { id: Tone; label: string; colors: [string, string] }[] = [
  { id: 'Dawn', label: 'Dawn', colors: ['#FFB36B', '#FF6F5E'] },
  { id: 'Nocturne', label: 'Nocturne', colors: ['#7ED7FF', '#5D7CFF'] },
  { id: 'Citrus', label: 'Citrus', colors: ['#E6FF77', '#41D67A'] },
];

const cardStyle: CSSProperties = {
  background: 'rgba(12, 18, 28, 0.58)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 30,
  boxShadow: '0 25px 90px rgba(0, 0, 0, 0.25)',
  overflow: 'hidden',
  position: 'relative',
};

function MagneticButton({ tone, powerOn }: { tone: Tone; powerOn: boolean }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 240, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 240, damping: 20, mass: 0.5 });
  const halo = tone === 'Dawn' ? '255, 152, 104' : tone === 'Nocturne' ? '110, 172, 255' : '150, 235, 102';
  const borderGlow = useMotionTemplate`0 18px 45px rgba(${halo}, ${powerOn ? 0.34 : 0.18})`;

  const handleMove = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * 0.16);
    y.set((event.clientY - rect.top - rect.height / 2) * 0.22);
  };

  return (
    <motion.button
      type="button"
      onMouseMove={handleMove}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={{ scale: 0.985 }}
      style={{
        alignItems: 'center',
        appearance: 'none',
        background:
          tone === 'Dawn'
            ? 'linear-gradient(135deg, #FFF4DB 0%, #FFC68A 50%, #FF7B6B 100%)'
            : tone === 'Nocturne'
              ? 'linear-gradient(135deg, #C8F1FF 0%, #7ED7FF 40%, #6A73FF 100%)'
              : 'linear-gradient(135deg, #FFFED1 0%, #D6FF6A 40%, #45D67D 100%)',
        border: 'none',
        borderRadius: 999,
        boxShadow: borderGlow,
        color: '#081018',
        cursor: 'pointer',
        display: 'inline-flex',
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
        fontSize: 15,
        fontWeight: 700,
        gap: 12,
        letterSpacing: '0.01em',
        padding: '18px 24px',
        x: springX,
        y: springY,
      }}>
      <span
        style={{
          background: 'rgba(8, 16, 24, 0.14)',
          borderRadius: 999,
          display: 'inline-flex',
          height: 34,
          justifyContent: 'center',
          placeItems: 'center',
          width: 34,
        }}>
        ↑
      </span>
      Launch the control study
    </motion.button>
  );
}

function PowerSwitch({
  powerOn,
  setPowerOn,
  tone,
}: {
  powerOn: boolean;
  setPowerOn: (value: boolean) => void;
  tone: Tone;
}) {
  const activeGradient =
    tone === 'Dawn'
      ? 'linear-gradient(135deg, rgba(255, 173, 115, 0.95), rgba(255, 96, 96, 0.9))'
      : tone === 'Nocturne'
        ? 'linear-gradient(135deg, rgba(126, 215, 255, 0.95), rgba(93, 124, 255, 0.95))'
        : 'linear-gradient(135deg, rgba(230, 255, 119, 0.95), rgba(65, 214, 122, 0.95))';

  return (
    <motion.button
      type="button"
      onClick={() => setPowerOn(!powerOn)}
      whileTap={{ scale: 0.99 }}
      style={{
        alignItems: 'center',
        appearance: 'none',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 999,
        color: '#F7F4EE',
        cursor: 'pointer',
        display: 'flex',
        gap: 12,
        justifyContent: 'space-between',
        padding: 10,
        width: '100%',
      }}>
      <div>
        <div style={{ fontSize: 13, letterSpacing: '0.14em', opacity: 0.56, textTransform: 'uppercase' }}>
          Power
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={powerOn ? 'on' : 'off'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontSize: 18, fontWeight: 700 }}>
            {powerOn ? 'Live glow' : 'Sleeping'}
          </motion.div>
        </AnimatePresence>
      </div>
      <div
        style={{
          background: powerOn ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
          borderRadius: 999,
          height: 52,
          padding: 4,
          position: 'relative',
          width: 110,
        }}>
        <motion.div
          animate={{
            background: powerOn ? activeGradient : 'linear-gradient(135deg, #324357, #1A2430)',
            x: powerOn ? 52 : 0,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          style={{
            borderRadius: 999,
            boxShadow: powerOn ? '0 10px 28px rgba(0, 0, 0, 0.2)' : 'none',
            height: 44,
            width: 50,
          }}
        />
      </div>
    </motion.button>
  );
}

function SuiteSelector({
  selectedSuite,
  setSelectedSuite,
}: {
  selectedSuite: Suite;
  setSelectedSuite: (suite: Suite) => void;
}) {
  return (
    <LayoutGroup id="suite-selector">
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 999,
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          padding: 6,
        }}>
        {suites.map((suite) => {
          const active = suite.id === selectedSuite;

          return (
            <button
              key={suite.id}
              type="button"
              onClick={() => setSelectedSuite(suite.id)}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                borderRadius: 999,
                color: active ? '#0B111A' : '#F7F4EE',
                cursor: 'pointer',
                fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                fontSize: 14,
                fontWeight: 700,
                padding: '14px 12px',
                position: 'relative',
              }}>
              {active ? (
                <motion.span
                  layoutId="suite-pill"
                  style={{
                    background: 'linear-gradient(135deg, #FFF4D9, #FFE18D)',
                    borderRadius: 999,
                    inset: 0,
                    position: 'absolute',
                  }}
                />
              ) : null}
              <span style={{ position: 'relative' }}>{suite.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function ToneSelector({ selectedTone, setSelectedTone }: { selectedTone: Tone; setSelectedTone: (tone: Tone) => void }) {
  return (
    <LayoutGroup id="tone-selector">
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {tones.map((tone) => {
          const active = tone.id === selectedTone;

          return (
            <button
              key={tone.id}
              type="button"
              onClick={() => setSelectedTone(tone.id)}
              style={{
                alignItems: 'center',
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                color: '#F7F4EE',
                cursor: 'pointer',
                display: 'inline-flex',
                gap: 10,
                padding: 0,
                position: 'relative',
              }}>
              <span
                style={{
                  borderRadius: 999,
                  display: 'inline-flex',
                  height: 44,
                  justifyContent: 'center',
                  position: 'relative',
                  width: 44,
                }}>
                {active ? (
                  <motion.span
                    layoutId="tone-ring"
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.8)',
                      borderRadius: 999,
                      inset: -4,
                      position: 'absolute',
                    }}
                  />
                ) : null}
                <span
                  style={{
                    background: `linear-gradient(135deg, ${tone.colors[0]}, ${tone.colors[1]})`,
                    borderRadius: 999,
                    boxShadow: active ? `0 0 35px ${tone.colors[0]}55` : 'none',
                    display: 'inline-flex',
                    height: 44,
                    width: 44,
                  }}
                />
              </span>
              <span style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontWeight: 700 }}>{tone.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function IntensityMixer({
  intensity,
  setIntensity,
  selectedTone,
}: {
  intensity: number;
  setIntensity: (value: number) => void;
  selectedTone: Tone;
}) {
  const bars = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);

  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
      }}>
      <div style={{ alignItems: 'end', display: 'grid', gap: 10, gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
        {bars.map((step) => {
          const active = step <= intensity;
          const hue =
            selectedTone === 'Dawn'
              ? 'linear-gradient(180deg, #FFE198 0%, #FF806B 100%)'
              : selectedTone === 'Nocturne'
                ? 'linear-gradient(180deg, #B9F3FF 0%, #6A73FF 100%)'
                : 'linear-gradient(180deg, #FAFFD1 0%, #4ED684 100%)';

          return (
            <motion.button
              key={step}
              type="button"
              onClick={() => setIntensity(step)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.96 }}
              animate={{
                opacity: active ? 1 : 0.35,
                scaleY: active ? 1 : 0.88,
              }}
              style={{
                appearance: 'none',
                background: active ? hue : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: 18,
                cursor: 'pointer',
                height: `${step * 8 + 30}px`,
                transformOrigin: 'bottom',
              }}
            />
          );
        })}
      </div>
      <div style={{ color: 'rgba(247, 244, 238, 0.78)', fontSize: 14 }}>
        Intensity set to <strong style={{ color: '#F7F4EE' }}>{intensity}</strong> / 12
      </div>
    </div>
  );
}

function PreviewOrb({
  intensity,
  selectedTone,
  powerOn,
  selectedSuite,
}: {
  intensity: number;
  selectedTone: Tone;
  powerOn: boolean;
  selectedSuite: Suite;
}) {
  const rotate = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const blur = useTransform(rotate, [0, 360], [14, 28]);
  const glow = useMotionTemplate`0 0 ${blur}px rgba(255, 255, 255, 0.28)`;
  const background =
    selectedTone === 'Dawn'
      ? 'linear-gradient(135deg, rgba(255, 232, 193, 0.96), rgba(255, 121, 105, 0.95))'
      : selectedTone === 'Nocturne'
        ? 'linear-gradient(135deg, rgba(208, 247, 255, 0.95), rgba(89, 100, 255, 0.95))'
        : 'linear-gradient(135deg, rgba(255, 255, 214, 0.96), rgba(78, 214, 132, 0.95))';

  return (
    <motion.div
      animate={
        reduceMotion
          ? { rotate: 0 }
          : { rotate: powerOn ? 360 : 0, scale: powerOn ? 1 + intensity * 0.018 : 0.92 }
      }
      onUpdate={(latest) => {
        if (typeof latest.rotate === 'number') {
          rotate.set(latest.rotate);
        }
      }}
      transition={reduceMotion ? undefined : { duration: 16, ease: 'linear', repeat: Infinity }}
      style={{
        alignItems: 'center',
        aspectRatio: '1 / 1',
        backdropFilter: 'blur(18px)',
        background,
        border: '1px solid rgba(255, 255, 255, 0.36)',
        borderRadius: '50%',
        boxShadow: glow,
        display: 'grid',
        justifyItems: 'center',
        marginInline: 'auto',
        maxWidth: 280,
        position: 'relative',
        width: '72%',
      }}>
      <motion.div
        animate={{
          borderRadius: selectedSuite === 'Lumen' ? '36% 64% 59% 41% / 42% 44% 56% 58%' : selectedSuite === 'Cascade'
            ? '58% 42% 39% 61% / 50% 52% 48% 50%'
            : '44% 56% 57% 43% / 58% 40% 60% 42%',
          rotate: powerOn ? -180 : 0,
          scale: powerOn ? 0.86 + intensity * 0.01 : 0.78,
        }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        style={{
          background: 'rgba(255, 255, 255, 0.32)',
          height: '56%',
          width: '56%',
        }}
      />
    </motion.div>
  );
}

export default function ControlsShowcase() {
  const reduceMotion = useReducedMotion();
  const [powerOn, setPowerOn] = useState(true);
  const [selectedSuite, setSelectedSuite] = useState<Suite>('Cascade');
  const [selectedTone, setSelectedTone] = useState<Tone>('Nocturne');
  const [intensity, setIntensity] = useState(8);

  const activeSuite = suites.find((suite) => suite.id === selectedSuite) ?? suites[0];
  const activeTone = tones.find((tone) => tone.id === selectedTone) ?? tones[0];

  return (
    <div
      style={{
        background:
          'radial-gradient(circle at top left, rgba(131, 214, 255, 0.18), transparent 28%), radial-gradient(circle at 82% 18%, rgba(255, 189, 121, 0.18), transparent 24%), linear-gradient(180deg, #071019 0%, #0D1721 45%, #11151B 100%)',
        color: '#F7F4EE',
        minHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}>
      <motion.div
        animate={reduceMotion ? undefined : { x: [0, 50, -20, 0], y: [0, 30, -30, 0], scale: [1, 1.08, 0.95, 1] }}
        transition={reduceMotion ? undefined : { duration: 18, ease: 'easeInOut', repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(126, 215, 255, 0.34), transparent 66%)',
          height: 420,
          left: -120,
          pointerEvents: 'none',
          position: 'absolute',
          top: -120,
          width: 420,
        }}
      />
      <motion.div
        animate={reduceMotion ? undefined : { x: [0, -40, 20, 0], y: [0, -20, 25, 0], scale: [1, 0.94, 1.04, 1] }}
        transition={reduceMotion ? undefined : { duration: 20, ease: 'easeInOut', repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(255, 153, 102, 0.25), transparent 68%)',
          bottom: -160,
          height: 460,
          pointerEvents: 'none',
          position: 'absolute',
          right: -80,
          width: 460,
        }}
      />

      <main
        style={{
          margin: '0 auto',
          maxWidth: 1240,
          padding: '48px 24px 72px',
          position: 'relative',
          zIndex: 1,
        }}>
        <motion.section
          initial={reduceMotion ? undefined : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{
            ...cardStyle,
            display: 'grid',
            gap: 28,
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            padding: 32,
          }}>
          <div style={{ display: 'grid', gap: 22 }}>
            <div style={{ color: 'rgba(247, 244, 238, 0.62)', fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              Motion.dev showcase
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <h1
                style={{
                  fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
                  fontSize: 'clamp(3.3rem, 8vw, 6.8rem)',
                  fontWeight: 600,
                  letterSpacing: '-0.05em',
                  lineHeight: 0.92,
                  margin: 0,
                  maxWidth: 720,
                }}>
                Beautiful controls with pulse, depth, and restraint.
              </h1>
              <p
                style={{
                  color: 'rgba(247, 244, 238, 0.72)',
                  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                  fontSize: 18,
                  lineHeight: 1.6,
                  margin: 0,
                  maxWidth: 620,
                }}>
                A small web page for showcasing tactile controls built with Motion: magnetic buttons,
                liquid toggles, shared-layout selectors, and a responsive mixer that all feed the same live preview.
              </p>
            </div>
            <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <MagneticButton tone={selectedTone} powerOn={powerOn} />
              <div
                style={{
                  backdropFilter: 'blur(14px)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 999,
                  display: 'inline-flex',
                  gap: 12,
                  padding: '14px 18px',
                }}>
                <span style={{ color: 'rgba(247, 244, 238, 0.54)', fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                  Current suite
                </span>
                <strong style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontSize: 15 }}>
                  {activeSuite.label}
                </strong>
              </div>
            </div>
          </div>

          <div
            style={{
              ...cardStyle,
              alignSelf: 'stretch',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))',
              display: 'grid',
              gap: 18,
              minHeight: 400,
              padding: 24,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'rgba(247, 244, 238, 0.52)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  Live preview
                </div>
                <div style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontSize: 24, fontWeight: 700 }}>
                  {activeSuite.label} / {activeTone.label}
                </div>
              </div>
              <div
                style={{
                  background: powerOn ? 'rgba(76, 235, 150, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                  border: `1px solid ${powerOn ? 'rgba(76, 235, 150, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: 999,
                  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '10px 14px',
                }}>
                {powerOn ? 'System awake' : 'System idle'}
              </div>
            </div>

            <div
              style={{
                alignItems: 'center',
                display: 'grid',
                flex: 1,
                gap: 24,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}>
              <PreviewOrb
                intensity={intensity}
                powerOn={powerOn}
                selectedSuite={selectedSuite}
                selectedTone={selectedTone}
              />
              <div style={{ display: 'grid', gap: 14 }}>
                {[
                  ['Mode', activeSuite.label],
                  ['Finish', activeTone.label],
                  ['Intensity', `${intensity.toString().padStart(2, '0')} / 12`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: 22,
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '16px 18px',
                    }}>
                    <span style={{ color: 'rgba(247, 244, 238, 0.56)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {label}
                    </span>
                    <strong style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif' }}>{value}</strong>
                  </div>
                ))}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={selectedSuite}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22 }}
                    style={{
                      color: 'rgba(247, 244, 238, 0.7)',
                      fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
                      lineHeight: 1.6,
                      margin: 0,
                    }}>
                    {activeSuite.blurb}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.section>

        <section
          style={{
            display: 'grid',
            gap: 22,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            marginTop: 24,
          }}>
          <motion.article
            initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45 }}
            style={{ ...cardStyle, display: 'grid', gap: 18, padding: 24 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'rgba(247, 244, 238, 0.52)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Fluid toggle
              </div>
              <h2 style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontSize: 24, margin: 0 }}>Power state</h2>
            </div>
            <PowerSwitch powerOn={powerOn} setPowerOn={setPowerOn} tone={selectedTone} />
            <p style={{ color: 'rgba(247, 244, 238, 0.68)', lineHeight: 1.6, margin: 0 }}>
              A tactile switch with animated label handoff and a spring-loaded thumb.
            </p>
          </motion.article>

          <motion.article
            initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.45 }}
            style={{ ...cardStyle, display: 'grid', gap: 18, padding: 24 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'rgba(247, 244, 238, 0.52)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Shared layout
              </div>
              <h2 style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontSize: 24, margin: 0 }}>Suite selector</h2>
            </div>
            <SuiteSelector selectedSuite={selectedSuite} setSelectedSuite={setSelectedSuite} />
            <p style={{ color: 'rgba(247, 244, 238, 0.68)', lineHeight: 1.6, margin: 0 }}>
              One animated highlight ties the segmented control together without visual noise.
            </p>
          </motion.article>

          <motion.article
            initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            style={{ ...cardStyle, display: 'grid', gap: 18, padding: 24 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'rgba(247, 244, 238, 0.52)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Finish swatches
              </div>
              <h2 style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontSize: 24, margin: 0 }}>Tone palette</h2>
            </div>
            <ToneSelector selectedTone={selectedTone} setSelectedTone={setSelectedTone} />
            <p style={{ color: 'rgba(247, 244, 238, 0.68)', lineHeight: 1.6, margin: 0 }}>
              Compact color controls with a shared selection ring and tone-specific glow.
            </p>
          </motion.article>

          <motion.article
            initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.45 }}
            style={{ ...cardStyle, display: 'grid', gap: 18, padding: 24 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'rgba(247, 244, 238, 0.52)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Visual mixer
              </div>
              <h2 style={{ fontFamily: '"Avenir Next", "Segoe UI", sans-serif', fontSize: 24, margin: 0 }}>Intensity</h2>
            </div>
            <IntensityMixer intensity={intensity} selectedTone={selectedTone} setIntensity={setIntensity} />
            <p style={{ color: 'rgba(247, 244, 238, 0.68)', lineHeight: 1.6, margin: 0 }}>
              Twelve bars animate as a single instrument and feed the preview in real time.
            </p>
          </motion.article>
        </section>
      </main>
    </div>
  );
}
