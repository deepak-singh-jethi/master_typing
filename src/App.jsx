import { AppRouter } from "@/app/AppRouter";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  );
}
