import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ForecastExpense, ForecastPayrollMember } from "@shared/schema";

export function ExpensesTab() {
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ForecastExpense | null>(null);
  const { toast } = useToast();
  
  // Fetch expenses (exclude payroll type now since we have dedicated payroll members)
  const { data: expenses = [] } = useQuery<ForecastExpense[]>({
    queryKey: ["/api/forecast/expenses"],
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/expenses/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/expenses"] });
      toast({ title: "Expense deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete expense", variant: "destructive" });
    },
  });

  // Filter out payroll expenses since they're now managed through payroll members
  const nonPayrollExpenses = expenses.filter(exp => exp.type !== "payroll");

  return (
    <div className="space-y-4">
      {/* Payroll Members Section */}
      <PayrollMembersCard />
      
      {/* Other Expenses Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Other Expenses</CardTitle>
              <CardDescription>Track systems, software, and other recurring expenses</CardDescription>
            </div>
            <Button onClick={() => setIsAddingExpense(!isAddingExpense)} data-testid="button-add-expense">
              {isAddingExpense ? "Cancel" : "Add Expense"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAddingExpense && <ExpenseForm onSuccess={() => setIsAddingExpense(false)} />}
          {editingExpense && (
            <ExpenseForm 
              expense={editingExpense}
              onSuccess={() => setEditingExpense(null)} 
            />
          )}
          
          <div className="space-y-2">
            {nonPayrollExpenses.length > 0 ? (
              nonPayrollExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`expense-${expense.id}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">${expense.amount}</div>
                      {expense.isRecurring && (
                        <Badge variant="outline" data-testid={`badge-recurring-${expense.id}`}>
                          {expense.recurrenceInterval}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {expense.type} - {expense.date}
                      {expense.recurrenceEndDate && ` to ${expense.recurrenceEndDate}`}
                      {expense.description && ` - ${expense.description}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingExpense(expense)}
                      data-testid={`button-edit-expense-${expense.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteExpense.mutate(expense.id)}
                      data-testid={`button-delete-expense-${expense.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">No other expenses yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PayrollMembersCard() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const { toast } = useToast();
  
  const { data: members = [] } = useQuery<ForecastPayrollMember[]>({
    queryKey: ["/api/forecast/payroll-members"],
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/payroll-members/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/payroll-members"] });
      toast({ title: "Payroll member deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete payroll member", variant: "destructive" });
    },
  });

  const handleEditComplete = () => {
    setEditingId(null);
  };

  const handleAddComplete = () => {
    setIsAddingNew(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payroll Members</CardTitle>
            <CardDescription>
              Track individual team member payroll expenses (paid bi-monthly on 15th and end of month)
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddingNew(!isAddingNew)} data-testid="button-add-payroll-member">
            <Plus className="h-4 w-4 mr-2" />
            {isAddingNew ? "Cancel" : "Add Member"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Name</TableHead>
              <TableHead>Monthly Pay</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAddingNew && (
              <PayrollMemberRow
                isNew
                onComplete={handleAddComplete}
                onCancel={() => setIsAddingNew(false)}
              />
            )}
            {members.map((member) => (
              <PayrollMemberRow
                key={member.id}
                member={member}
                isEditing={editingId === member.id}
                onEdit={() => setEditingId(member.id)}
                onComplete={handleEditComplete}
                onCancel={() => setEditingId(null)}
                onDelete={() => deleteMember.mutate(member.id)}
              />
            ))}
            {members.length === 0 && !isAddingNew && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No payroll members yet. Click "Add Member" to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayrollMemberRow({
  member,
  isNew = false,
  isEditing = false,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
}: {
  member?: ForecastPayrollMember;
  isNew?: boolean;
  isEditing?: boolean;
  onEdit?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(member?.name || "");
  const [monthlyPay, setMonthlyPay] = useState(member?.monthlyPay || "");
  const [startDate, setStartDate] = useState(member?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(member?.endDate || "");
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (member && !isNew) {
        return await apiRequest(`/api/forecast/payroll-members/${member.id}`, "PATCH", data);
      }
      return await apiRequest("/api/forecast/payroll-members", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/payroll-members"] });
      toast({ title: isNew ? "Payroll member added" : "Payroll member updated" });
      onComplete?.();
    },
    onError: () => {
      toast({ title: isNew ? "Failed to add payroll member" : "Failed to update payroll member", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      name,
      monthlyPay,
      startDate,
      endDate: endDate || null,
      isActive: true,
    });
  };

  if (isNew || isEditing) {
    return (
      <TableRow>
        <TableCell>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Member name"
            data-testid="input-payroll-member-name"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="0.01"
            value={monthlyPay}
            onChange={(e) => setMonthlyPay(e.target.value)}
            placeholder="0.00"
            data-testid="input-payroll-member-pay"
          />
        </TableCell>
        <TableCell>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-testid="input-payroll-member-start-date"
          />
        </TableCell>
        <TableCell>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Ongoing"
            data-testid="input-payroll-member-end-date"
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={saveMutation.isPending || !name || !monthlyPay}
              data-testid="button-save-payroll-member"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={saveMutation.isPending}
              data-testid="button-cancel-payroll-member"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow data-testid={`payroll-member-${member?.id}`}>
      <TableCell className="font-medium">{member?.name}</TableCell>
      <TableCell>${parseFloat(member?.monthlyPay || "0").toLocaleString()}</TableCell>
      <TableCell>{member?.startDate}</TableCell>
      <TableCell>{member?.endDate || <span className="text-muted-foreground">Ongoing</span>}</TableCell>
      <TableCell className="text-right">
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            data-testid={`button-edit-payroll-member-${member?.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            data-testid={`button-delete-payroll-member-${member?.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ExpenseForm({ expense, onSuccess }: { expense?: ForecastExpense; onSuccess: () => void }) {
  const [type, setType] = useState(expense?.type || "systems");
  const [amount, setAmount] = useState(expense?.amount || "");
  const [date, setDate] = useState(expense?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(expense?.description || "");
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring || false);
  const [recurrenceInterval, setRecurrenceInterval] = useState(expense?.recurrenceInterval || "monthly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(expense?.recurrenceEndDate || "");
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (expense) {
        return await apiRequest(`/api/forecast/expenses/${expense.id}`, "PATCH", data);
      }
      return await apiRequest("/api/forecast/expenses", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/expenses"] });
      toast({ title: expense ? "Expense updated" : (isRecurring ? "Recurring expenses added successfully" : "Expense added successfully") });
      onSuccess();
    },
    onError: () => {
      toast({ title: expense ? "Failed to update expense" : "Failed to add expense", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      type,
      amount,
      date,
      description: description || null,
      isRecurring,
      recurrenceInterval: isRecurring ? recurrenceInterval : null,
      recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expense-type">Type</Label>
          <select
            id="expense-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full p-2 border rounded-md bg-background text-foreground"
            data-testid="select-expense-type"
          >
            <option value="systems">Systems</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Amount</Label>
          <Input
            id="expense-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            data-testid="input-expense-amount"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expense-date">Start Date</Label>
          <Input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            data-testid="input-expense-date"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-description">Description (optional)</Label>
          <Input
            id="expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="input-expense-description"
          />
        </div>
      </div>
      
      <div className="space-y-4 p-3 bg-muted/30 rounded-md">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="expense-recurring"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="w-4 h-4"
            data-testid="checkbox-expense-recurring"
          />
          <Label htmlFor="expense-recurring" className="cursor-pointer">Make this recurring</Label>
        </div>
        
        {isRecurring && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense-interval">Interval</Label>
              <select
                id="expense-interval"
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(e.target.value)}
                className="w-full p-2 border rounded-md bg-background text-foreground"
                data-testid="select-expense-interval"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-end-date">End Date (optional)</Label>
              <Input
                id="expense-end-date"
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                data-testid="input-expense-end-date"
              />
            </div>
          </div>
        )}
      </div>

      <Button type="submit" disabled={saveMutation.isPending} data-testid="button-submit-expense">
        {saveMutation.isPending ? (expense ? "Updating..." : "Adding...") : (expense ? "Update Expense" : (isRecurring ? "Add Recurring Expense" : "Add Expense"))}
      </Button>
    </form>
  );
}
