import { EquipmentTrackerScreen } from '../components/EquipmentTrackerScreen';

export default function PumpingGearScreen() {
  return (
    <EquipmentTrackerScreen
      kind="pump-kit"
      title="Pumping gear"
      singularLabel="Pump kit"
      icon="💧"
    />
  );
}
