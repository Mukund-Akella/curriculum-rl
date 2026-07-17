import Header from "./components/Header";
import TrainingCurves from "./components/TrainingCurves";
import DifficultyProgression from "./components/DifficultyProgression";
import RobotTrajectory from "./components/RobotTrajectory";

export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <TrainingCurves />
        <DifficultyProgression />
        <RobotTrajectory />
      </main>
    </div>
  );
}
