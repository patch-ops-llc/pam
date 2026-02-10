import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface ColumnDef<T> {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "month" | "select";
  selectOptions?: { value: string; label: string }[];
  render?: (value: any, row: T) => React.ReactNode;
  editable?: boolean;
  width?: string;
  validate?: (value: any) => string | null;
  format?: (value: any) => string;
}

interface InlineEditableTableProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef<T>[];
  onUpdate: (id: string, updates: Partial<T>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  loading?: boolean;
  emptyMessage?: string;
  testIdPrefix?: string;
}

export function InlineEditableTable<T extends { id: string }>({
  data,
  columns,
  onUpdate,
  onDelete,
  loading = false,
  emptyMessage = "No data yet",
  testIdPrefix = "table",
}: InlineEditableTableProps<T>) {
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState<any>("");
  const [savingCell, setSavingCell] = useState<{ id: string; key: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const startEdit = (id: string, key: string, currentValue: any) => {
    setEditingCell({ id, key });
    setEditValue(currentValue ?? "");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    const { id, key } = editingCell;
    const row = data.find((r) => r.id === id);
    if (!row) return;

    const column = columns.find((c) => c.key === key);
    const currentValue = (row as any)[key];
    
    if (editValue === currentValue) {
      cancelEdit();
      return;
    }

    if (column?.validate) {
      const error = column.validate(editValue);
      if (error) {
        toast({ title: error, variant: "destructive" });
        return;
      }
    }

    setSavingCell(editingCell);
    try {
      await onUpdate(id, { [key]: editValue } as Partial<T>);
      cancelEdit();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ 
        title: "Failed to save changes", 
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive" 
      });
    } finally {
      setSavingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const renderCell = (row: T, column: ColumnDef<T>) => {
    const value = (row as any)[column.key];
    const isEditing = editingCell?.id === row.id && editingCell?.key === column.key;
    const isSaving = savingCell?.id === row.id && savingCell?.key === column.key;
    const editable = column.editable !== false;
    const displayValue = column.format ? column.format(value) : value;

    if (column.render && !isEditing) {
      return column.render(value, row);
    }

    if (!editable) {
      return <span className="text-sm">{displayValue ?? "-"}</span>;
    }

    if (isEditing) {
      if (column.type === "select" && column.selectOptions) {
        return (
          <Select
            value={editValue || ""}
            onValueChange={(val) => {
              setEditValue(val);
              setEditingCell({ id: row.id, key: column.key });
              setTimeout(async () => {
                if (column.validate) {
                  const error = column.validate(val);
                  if (error) {
                    toast({ title: error, variant: "destructive" });
                    cancelEdit();
                    return;
                  }
                }
                
                setSavingCell({ id: row.id, key: column.key });
                try {
                  await onUpdate(row.id, { [column.key]: val } as Partial<T>);
                  cancelEdit();
                } catch (error) {
                  console.error("Failed to save:", error);
                  toast({ 
                    title: "Failed to save changes", 
                    description: error instanceof Error ? error.message : "Please try again",
                    variant: "destructive" 
                  });
                } finally {
                  setSavingCell(null);
                }
              }, 0);
            }}
          >
            <SelectTrigger className="h-8" data-testid={`${testIdPrefix}-select-${column.key}-${row.id}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {column.selectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      return (
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type={column.type || "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm"
            data-testid={`${testIdPrefix}-input-${column.key}-${row.id}`}
          />
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      );
    }

    return (
      <button
        onClick={() => startEdit(row.id, column.key, value)}
        className="text-sm text-left w-full hover-elevate px-2 py-1 rounded -mx-2"
        data-testid={`${testIdPrefix}-cell-${column.key}-${row.id}`}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {displayValue ?? "-"}
        </span>
        <Pencil className="h-3 w-3 ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((column) => (
              <th
                key={column.key}
                className="text-left px-4 py-3 text-sm font-medium"
                style={{ width: column.width }}
              >
                {column.label}
              </th>
            ))}
            {onDelete && <th className="w-16"></th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.id}
              className={cn(
                "border-b last:border-b-0 group",
                index % 2 === 0 ? "bg-background" : "bg-muted/30"
              )}
              data-testid={`${testIdPrefix}-row-${row.id}`}
            >
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-2">
                  {renderCell(row, column)}
                </td>
              ))}
              {onDelete && (
                <td className="px-4 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(row.id)}
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`${testIdPrefix}-delete-${row.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
