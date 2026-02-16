import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, CalendarX, Table2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CapacityWorksheetTab } from "./capacity/CapacityWorksheetTab";
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

      <Tabs defaultValue="worksheet" className="space-y-4">
        <TabsList>
          <TabsTrigger value="worksheet" data-testid="tab-worksheet">
            <Table2 className="h-4 w-4 mr-2" />
            Capacity Worksheet
          </TabsTrigger>
          <TabsTrigger value="quotas" data-testid="tab-quotas">
            <Target className="h-4 w-4 mr-2" />
            Quotas
          </TabsTrigger>
          <TabsTrigger value="time-away" data-testid="tab-time-away">
            <CalendarX className="h-4 w-4 mr-2" />
            Time Away
          </TabsTrigger>
        </TabsList>

        <TabsContent value="worksheet">
          <CapacityWorksheetTab />
        </TabsContent>

        <TabsContent value="quotas">
          <QuotasTab />
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
