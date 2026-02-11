import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, CalendarX, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ResourcesTab } from "./capacity/ResourcesTab";
import { AllocationsTab } from "./capacity/AllocationsTab";
import { ReportsTab } from "./capacity/ReportsTab";
import { QuotasTab } from "./capacity/QuotasTab";
import { TimeOffTab } from "./capacity/TimeOffTab";
import { HolidaysTab } from "./capacity/HolidaysTab";

export default function Capacity() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Capacity Management"
        description="Team capacity, allocations, quotas, and time tracking"
      />

      <Tabs defaultValue="quotas-bonuses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quotas-bonuses" data-testid="tab-quotas-bonuses">
            <Target className="h-4 w-4 mr-2" />
            Quotas & Bonuses
          </TabsTrigger>
          <TabsTrigger value="capacity-planning" data-testid="tab-capacity-planning">
            <BarChart3 className="h-4 w-4 mr-2" />
            Capacity Planning
          </TabsTrigger>
          <TabsTrigger value="time-away" data-testid="tab-time-away">
            <CalendarX className="h-4 w-4 mr-2" />
            Time Away
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotas-bonuses">
          <QuotasTab />
        </TabsContent>

        <TabsContent value="capacity-planning" className="space-y-6">
          <ResourcesTab />
          <AllocationsTab />
          <ReportsTab />
        </TabsContent>

        <TabsContent value="time-away" className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Time Off</h3>
            <TimeOffTab />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Holidays</h3>
            <HolidaysTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
