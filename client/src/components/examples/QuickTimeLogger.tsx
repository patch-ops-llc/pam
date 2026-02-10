import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { QuickTimeLogger } from '../QuickTimeLogger';

export default function QuickTimeLoggerExample() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-6 bg-background">
        <QuickTimeLogger />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}