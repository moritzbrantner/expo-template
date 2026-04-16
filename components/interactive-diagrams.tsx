import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';
import { useAuth } from '@/providers/auth-provider';

type DiagramId = 'Signal Mesh' | 'Ops Loop' | 'Release Pulse';

type DiagramNode = {
  id: string;
  label: string;
  caption: string;
};

type DiagramDefinition = {
  id: DiagramId;
  eyebrow: string;
  title: string;
  description: string;
  nodes: DiagramNode[];
  edges: [string, string][];
};

const diagrams: DiagramDefinition[] = [
  {
    id: 'Signal Mesh',
    eyebrow: 'Realtime architecture',
    title: 'Signal Mesh',
    description:
      'Trace how product events travel from capture, through enrichment, into the live decision layer.',
    nodes: [
      { id: 'capture', label: 'Capture', caption: 'Events are ingested from the product surface.' },
      { id: 'profile', label: 'Profile', caption: 'Identity resolution shapes the user graph.' },
      { id: 'rules', label: 'Rules', caption: 'Policies and thresholds decide what matters now.' },
      { id: 'notify', label: 'Notify', caption: 'Operators and users receive the final signal.' },
    ],
    edges: [
      ['capture', 'profile'],
      ['profile', 'rules'],
      ['rules', 'notify'],
    ],
  },
  {
    id: 'Ops Loop',
    eyebrow: 'Incident response',
    title: 'Ops Loop',
    description:
      'Switch focus between telemetry, triage, rollout, and review to explain the operating rhythm.',
    nodes: [
      { id: 'detect', label: 'Detect', caption: 'Dashboards surface drift, latency, or failure spikes.' },
      { id: 'triage', label: 'Triage', caption: 'Signals are grouped into an actionable incident thread.' },
      { id: 'patch', label: 'Patch', caption: 'Teams ship a constrained remediation or rollback.' },
      { id: 'review', label: 'Review', caption: 'Findings feed the next playbook revision.' },
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
      'Map the handoff from planning to validation, launch, and measurement without losing context.',
    nodes: [
      { id: 'plan', label: 'Plan', caption: 'Define the scope, success metric, and blast radius.' },
      { id: 'build', label: 'Build', caption: 'Ship the feature behind a bounded rollout plan.' },
      { id: 'validate', label: 'Validate', caption: 'Measure quality, behavior, and guardrail health.' },
      { id: 'expand', label: 'Expand', caption: 'Increase exposure only after the signals stay clean.' },
    ],
    edges: [
      ['plan', 'build'],
      ['build', 'validate'],
      ['validate', 'expand'],
    ],
  },
];

export default function InteractiveDiagrams() {
  const router = useRouter();
  const { currentUser, isHydrating, signOut } = useAuth();
  const { activeTheme } = useThemeMode();
  const palette = Colors[activeTheme];
  const [activeDiagramId, setActiveDiagramId] = useState<DiagramId>('Signal Mesh');
  const activeDiagram = diagrams.find((diagram) => diagram.id === activeDiagramId) ?? diagrams[0];
  const [activeNodeId, setActiveNodeId] = useState(activeDiagram.nodes[0]?.id ?? '');
  const activeNode = activeDiagram.nodes.find((node) => node.id === activeNodeId) ?? activeDiagram.nodes[0];
  const sessionStatus = isHydrating
    ? 'Restoring session...'
    : currentUser
      ? `Signed in as ${currentUser.email}`
      : 'No active session.';

  const activeEdges = activeDiagram.edges.filter(
    ([source, target]) => source === activeNode?.id || target === activeNode?.id,
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: activeTheme === 'dark' ? '#0F1821' : '#F6F1E8',
            borderColor: palette.border,
          },
        ]}>
        <ThemedText style={styles.eyebrow}>Interactive diagrams</ThemedText>
        <ThemedText type="title" style={styles.heroTitle}>
          Diagram studio for systems, operations, and release flows.
        </ThemedText>
        <ThemedText style={[styles.heroCopy, { color: palette.mutedText }]}>
          The web screen adds animated topology and richer motion. Native keeps the same content in
          a lighter touch layout.
        </ThemedText>
      </View>

      <View
        style={[
          styles.sessionCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}>
        <View style={styles.sessionCopy}>
          <ThemedText style={styles.sessionEyebrow}>Authentication</ThemedText>
          <ThemedText type="subtitle">Session status</ThemedText>
          <ThemedText testID="session-status">{sessionStatus}</ThemedText>
        </View>
        {currentUser ? (
          <Pressable
            accessibilityRole="button"
            style={[styles.sessionButton, { backgroundColor: '#8A1C1C' }]}
            testID="signout-button"
            onPress={signOut}>
            <ThemedText style={styles.sessionButtonText}>Sign out</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={[styles.sessionButton, { backgroundColor: palette.accent }]}
            onPress={() => router.push('/auth/sign-in')}>
            <ThemedText style={styles.sessionButtonText}>Sign in</ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.diagramSelector}>
        {diagrams.map((diagram) => {
          const isActive = diagram.id === activeDiagram.id;

          return (
            <Pressable
              key={diagram.id}
              accessibilityRole="button"
              onPress={() => {
                setActiveDiagramId(diagram.id);
                setActiveNodeId(diagram.nodes[0]?.id ?? '');
              }}
              style={[
                styles.diagramButton,
                {
                  backgroundColor: isActive ? palette.accent : palette.surface,
                  borderColor: isActive ? palette.accent : palette.border,
                },
              ]}>
              <ThemedText
                type="defaultSemiBold"
                style={{ color: isActive ? '#07131A' : palette.text }}>
                {diagram.id}
              </ThemedText>
              <ThemedText style={{ color: isActive ? '#07131A' : palette.mutedText }}>
                {diagram.eyebrow}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.diagramCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}>
        <ThemedText style={styles.sectionEyebrow}>{activeDiagram.eyebrow}</ThemedText>
        <ThemedText type="subtitle">{activeDiagram.title}</ThemedText>
        <ThemedText style={{ color: palette.mutedText }}>{activeDiagram.description}</ThemedText>

        <View style={styles.nodeGrid}>
          {activeDiagram.nodes.map((node, index) => {
            const isActive = node.id === activeNode?.id;

            return (
              <Pressable
                key={node.id}
                accessibilityRole="button"
                onPress={() => setActiveNodeId(node.id)}
                style={[
                  styles.nodeButton,
                  {
                    backgroundColor: isActive ? palette.accentSurface : palette.background,
                    borderColor: isActive ? palette.accent : palette.border,
                  },
                ]}>
                <ThemedText style={styles.nodeStep}>Step {index + 1}</ThemedText>
                <ThemedText type="defaultSemiBold">{node.label}</ThemedText>
                <ThemedText style={{ color: palette.mutedText }}>{node.caption}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.inspector,
            {
              backgroundColor: palette.background,
              borderColor: palette.border,
            },
          ]}>
          <ThemedText style={styles.sectionEyebrow}>Focused node</ThemedText>
          <ThemedText type="subtitle">{activeNode?.label ?? 'Select a node'}</ThemedText>
          <ThemedText style={{ color: palette.mutedText }}>
            {activeNode?.caption ?? 'Choose a node to inspect its role in the active flow.'}
          </ThemedText>
          <ThemedText type="defaultSemiBold">Active path</ThemedText>
          {activeEdges.map(([source, target]) => (
            <ThemedText key={`${source}-${target}`} style={{ color: palette.mutedText }}>
              {source} to {target}
            </ThemedText>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    gap: 14,
    padding: 24,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    lineHeight: 38,
  },
  heroCopy: {
    maxWidth: 640,
  },
  sessionCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  sessionCopy: {
    gap: 6,
  },
  sessionEyebrow: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sessionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  sessionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  diagramSelector: {
    gap: 12,
  },
  diagramButton: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 4,
    padding: 18,
  },
  diagramCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  sectionEyebrow: {
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  nodeGrid: {
    gap: 12,
  },
  nodeButton: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  nodeStep: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  inspector: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
});
