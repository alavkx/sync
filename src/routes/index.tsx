import { createFileRoute } from "@tanstack/react-router";
import { CodeReviewDemo } from "../components/CodeReviewDemo";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <CodeReviewDemo />
      </div>
    </div>
  );
}
