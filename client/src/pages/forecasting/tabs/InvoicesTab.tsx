import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ForecastInvoice } from "@shared/schema";

type SortField = "client" | "amount" | "date" | "dueDate" | "realizationDate" | "status";
type SortDirection = "asc" | "desc";

export function InvoicesTab() {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const { toast } = useToast();
  
  const { data: invoices = [] } = useQuery<ForecastInvoice[]>({
    queryKey: ["/api/forecast/invoices"],
  });
  
  const { data: agencies = [] } = useQuery<any[]>({ 
    queryKey: ["/api/clients"] 
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/invoices/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/invoices"] });
      toast({ title: "Invoice deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === "asc" ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Apply filters
    if (filterClient) {
      filtered = filtered.filter(inv => String(inv.agencyId) === String(filterClient));
    }
    if (filterStatus) {
      filtered = filtered.filter(inv => inv.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "client":
          aValue = agencies.find((ag: any) => ag.id === a.agencyId)?.name || "";
          bValue = agencies.find((ag: any) => ag.id === b.agencyId)?.name || "";
          break;
        case "amount":
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "dueDate":
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case "realizationDate":
          aValue = a.realizationDate ? new Date(a.realizationDate).getTime() : 0;
          bValue = b.realizationDate ? new Date(b.realizationDate).getTime() : 0;
          break;
        case "status":
          aValue = a.status || "pending";
          bValue = b.status || "pending";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [invoices, agencies, filterClient, filterStatus, sortField, sortDirection]);

  const totals = useMemo(() => {
    const total = filteredAndSortedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    const pending = filteredAndSortedInvoices
      .filter(inv => inv.status === "pending")
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    const received = filteredAndSortedInvoices
      .filter(inv => inv.status === "received")
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    
    return {
      count: filteredAndSortedInvoices.length,
      total,
      pending,
      received,
    };
  }, [filteredAndSortedInvoices]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Revenue Invoices</CardTitle>
            <CardDescription>
              Manage pre-billed and outstanding invoices. Use <strong>Realization Date</strong> for when payment is expected.
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddingNew(!isAddingNew)} data-testid="button-add-invoice">
            <Plus className="h-4 w-4 mr-2" />
            {isAddingNew ? "Cancel" : "Add Invoice"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="filter-client" className="text-sm">Filter by Client</Label>
            <Select value={filterClient || "all"} onValueChange={(value) => setFilterClient(value === "all" ? "" : value)}>
              <SelectTrigger id="filter-client" data-testid="select-filter-client">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {agencies.map((agency: any) => (
                  <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="filter-status" className="text-sm">Filter by Status</Label>
            <Select value={filterStatus || "all"} onValueChange={(value) => setFilterStatus(value === "all" ? "" : value)}>
              <SelectTrigger id="filter-status" data-testid="select-filter-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(filterClient || filterStatus) && (
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => { setFilterClient(""); setFilterStatus(""); }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleSort("client")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  data-testid="sort-client"
                >
                  Client
                  <SortIcon field="client" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleSort("amount")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  data-testid="sort-amount"
                >
                  Amount
                  <SortIcon field="amount" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleSort("date")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  data-testid="sort-date"
                >
                  Invoice Date
                  <SortIcon field="date" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleSort("dueDate")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  data-testid="sort-due-date"
                >
                  Due Date
                  <SortIcon field="dueDate" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleSort("realizationDate")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  data-testid="sort-realization-date"
                >
                  Realization Date
                  <SortIcon field="realizationDate" />
                </Button>
              </TableHead>
              <TableHead>Forecast Month</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleSort("status")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  data-testid="sort-status"
                >
                  Status
                  <SortIcon field="status" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAddingNew && (
              <InvoiceRow 
                agencies={agencies}
                onSuccess={() => setIsAddingNew(false)} 
                onCancel={() => setIsAddingNew(false)}
              />
            )}
            {filteredAndSortedInvoices.map((invoice) => (
              editingId === invoice.id ? (
                <InvoiceRow 
                  key={invoice.id}
                  invoice={invoice}
                  agencies={agencies}
                  onSuccess={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {agencies.find((a: any) => a.id === invoice.agencyId)?.name || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${parseFloat(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell>{invoice.dueDate || "-"}</TableCell>
                  <TableCell>{invoice.realizationDate || "-"}</TableCell>
                  <TableCell>{invoice.forecastMonth || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {invoice.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={invoice.status === "received" ? "default" : "secondary"}
                      data-testid={`badge-status-${invoice.id}`}
                    >
                      {invoice.status || "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingId(invoice.id)}
                        data-testid={`button-edit-invoice-${invoice.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(invoice.id)}
                        data-testid={`button-delete-invoice-${invoice.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            ))}
            {filteredAndSortedInvoices.length === 0 && !isAddingNew && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {filterClient || filterStatus ? "No invoices match the current filters" : "No invoices configured yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {filteredAndSortedInvoices.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">
                  Total ({totals.count} invoice{totals.count !== 1 ? 's' : ''})
                </TableCell>
                <TableCell className="font-bold text-lg">
                  ${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  Pending: ${totals.pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • 
                  Received: ${totals.received.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ 
  invoice, 
  agencies,
  onSuccess, 
  onCancel 
}: { 
  invoice?: ForecastInvoice;
  agencies: any[];
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    agencyId: invoice?.agencyId || "",
    amount: invoice?.amount || "",
    date: invoice?.date || new Date().toISOString().split('T')[0],
    dueDate: invoice?.dueDate || "",
    realizationDate: invoice?.realizationDate || "",
    forecastMonth: invoice?.forecastMonth || "",
    description: invoice?.description || "",
    status: invoice?.status || "pending",
  });
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        type: "invoice",
        ...data,
        agencyId: data.agencyId || null,
        dueDate: data.dueDate || null,
        realizationDate: data.realizationDate || null,
        forecastMonth: data.forecastMonth || null,
        description: data.description || null,
      };
      
      if (invoice) {
        return await apiRequest(`/api/forecast/invoices/${invoice.id}`, "PATCH", payload);
      } else {
        return await apiRequest("/api/forecast/invoices", "POST", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/invoices"] });
      toast({ title: invoice ? "Invoice updated" : "Invoice created" });
      onSuccess();
    },
    onError: () => {
      toast({ title: invoice ? "Failed to update invoice" : "Failed to create invoice", variant: "destructive" });
    },
  });

  return (
    <TableRow>
      <TableCell>
        <Select value={formData.agencyId || "none"} onValueChange={(value) => setFormData({ ...formData, agencyId: value === "none" ? "" : value })}>
          <SelectTrigger data-testid="select-invoice-agency">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {agencies.map((agency: any) => (
              <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input 
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          placeholder="0.00"
          data-testid="input-invoice-amount"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          data-testid="input-invoice-date"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          placeholder="Optional"
          data-testid="input-invoice-due-date"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="date"
          value={formData.realizationDate}
          onChange={(e) => setFormData({ ...formData, realizationDate: e.target.value })}
          placeholder="Optional"
          data-testid="input-invoice-realization-date"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="month"
          value={formData.forecastMonth ? formData.forecastMonth.substring(0, 7) : ""}
          onChange={(e) => setFormData({ ...formData, forecastMonth: e.target.value ? e.target.value + "-01" : "" })}
          placeholder="Optional"
          data-testid="input-invoice-forecast-month"
        />
      </TableCell>
      <TableCell>
        <Input 
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description"
          data-testid="input-invoice-description"
        />
      </TableCell>
      <TableCell>
        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
          <SelectTrigger data-testid="select-invoice-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => saveMutation.mutate(formData)}
            disabled={!formData.amount || !formData.date || saveMutation.isPending}
            data-testid="button-save-invoice"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            data-testid="button-cancel-invoice"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
