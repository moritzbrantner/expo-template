import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ARTrackingState } from '../lib/ar';
import type { ReconstructionSite } from '../lib/site';

type ViroComponent = ComponentType<Record<string, unknown>>;
type ViroModule = {
  ViroARScene: ViroComponent;
  ViroARSceneNavigator: ViroComponent;
  ViroAmbientLight: ViroComponent;
  ViroBox: ViroComponent;
  ViroNode: ViroComponent;
  ViroMaterials: {
    createMaterials: (materials: Record<string, unknown>) => void;
  };
  ViroTrackingStateConstants: {
    TRACKING_UNAVAILABLE: number;
    TRACKING_LIMITED: number;
    TRACKING_NORMAL: number;
  };
};

// The dependency is intentionally app-local: the repository-wide web install does not need native AR.
const viro = require('@reactvision/react-viro') as ViroModule;

const {
  ViroARScene,
  ViroARSceneNavigator,
  ViroAmbientLight,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroTrackingStateConstants,
} = viro;

ViroMaterials.createMaterials({
  horizonOneStone: {
    diffuseColor: '#d5c7b0',
    lightingModel: 'Lambert',
  },
  horizonOneRoof: {
    diffuseColor: '#876b58',
    lightingModel: 'Lambert',
  },
});

type SceneAppProps = {
  site: ReconstructionSite;
  blend: number;
  onTrackingState: (state: ARTrackingState) => void;
};

type SceneProps = {
  sceneNavigator?: {
    viroAppProps?: SceneAppProps;
  };
};

type Props = SceneAppProps;

function trackingStateFromViro(state: number): ARTrackingState {
  if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
    return 'normal';
  }
  if (state === ViroTrackingStateConstants.TRACKING_LIMITED) {
    return 'limited';
  }
  if (state === ViroTrackingStateConstants.TRACKING_UNAVAILABLE) {
    return 'unavailable';
  }
  return 'initializing';
}

function ReconstructionScene({ sceneNavigator }: SceneProps) {
  const appProps = sceneNavigator?.viroAppProps;

  if (!appProps) {
    return <ViroARScene />;
  }

  const { site, blend, onTrackingState } = appProps;

  return (
    <ViroARScene
      onTrackingUpdated={(state: unknown) => {
        if (typeof state === 'number') {
          onTrackingState(trackingStateFromViro(state));
        }
      }}>
      <ViroAmbientLight color="#ffffff" intensity={260} />
      <ViroNode
        opacity={blend}
        position={[...site.calibration.position]}
        rotation={[...site.calibration.rotation]}
        scale={[...site.calibration.scale]}>
        <ViroBox
          height={3.2}
          length={0.65}
          materials={['horizonOneStone']}
          position={[-1.4, 0.8, 0]}
          width={0.85}
        />
        <ViroBox
          height={3.2}
          length={0.65}
          materials={['horizonOneStone']}
          position={[1.4, 0.8, 0]}
          width={0.85}
        />
        <ViroBox
          height={0.55}
          length={0.65}
          materials={['horizonOneStone']}
          position={[0, 1.92, 0]}
          width={2.25}
        />
        <ViroBox
          height={0.35}
          length={0.9}
          materials={['horizonOneRoof']}
          position={[0, 2.45, 0]}
          width={3.35}
        />
      </ViroNode>
    </ViroARScene>
  );
}

export function ARExperience({ site, blend, onTrackingState }: Props) {
  return (
    <View style={styles.fill}>
      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: ReconstructionScene }}
        style={styles.fill}
        viroAppProps={{ site, blend, onTrackingState }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
