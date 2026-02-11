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
          <TabsTrigger value="allocations-reports" data-testid="tab-allocations-reports">
            <BarChart3 className="h-4 w-4 mr-2" />
            Allocations & Reports
          </TabsTrigger>
          <TabsTrigger value="time-away" data-testid="tab-time-away">
            <CalendarX className="h-4 w-4 mr-2" />
            Time Away
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotas-bonuses">
          <QuotasTab />
        </TabsContent>

        <TabsContent value="allocations-reports">
          <Tabs defaultValue="resources" className="space-y-4">
            <TabsList>
              <TabsTrigger value="resources" data-testid="subtab-resources">
                <Users className="h-4 w-4 mr-2" />
                Resources
              </TabsTrigger>
              <TabsTrigger value="allocations" data-testid="subtab-allocations">
                Allocations
              </TabsTrigger>
              <TabsTrigger value="reports" data-testid="subtab-reports">
                Reports
              </TabsTrigger>
            </TabsList>
            <TabsContent value="resources">
              <ResourcesTab />
            </TabsContent>
            <TabsContent value="allocations">
              <AllocationsTab />
            </TabsContent>
            <TabsContent value="reports">
              <ReportsTab />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="time-away">
          <Tabs defaultValue="time-off" className="space-y-4">
            <TabsList>
              <TabsTrigger value="time-off" data-testid="subtab-time-off">
                Time Off
              </TabsTrigger>
              <TabsTrigger value="holidays" data-testid="subtab-holidays">
                Holidays
              </TabsTrigger>
            </TabsList>
            <TabsContent value="time-off">
              <TimeOffTab />
            </TabsContent>
            <TabsContent value="holidays">
              <HolidaysTab />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
