import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DollarSign, TrendingUp, AlertCircle, FileText, Users, Plus, User, CheckCircle2, Circle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface Note {
  id: string;
  content: string;
  timestamp: string;
  author: string;
}

interface Todo {
  id: string;
  task: string;
  completed: boolean;
  dueDate: string;
}

interface EnterpriseGroupModalProps {
  open: boolean;
  onClose: () => void;
  groupData: {
    enterpriseGroup: string;
    enterpriseAccount: string;
    enterpriseSubaccount: string;
    site: string;
    ban: string;
    totalUsers: number;
    totalOutstanding: number;
    totalPaid: number;
    totalDisputed: number;
    totalCases: number;
    avgRiskScore: number;
    avgDaysPastDue: number;
    largestInvoice: string;
    topMSISDNs: Array<{ msisdn: string; debt: number }>;
    notes?: Note[];
    todos?: Todo[];
    customers: Array<{
      customerName: string;
      msisdn: string;
      invoiceNo: string;
      outstanding: number;
      disputed: number;
      paid: number;
      riskScore: number;
      daysPastDue: number;
      status: string;
      agentName?: string;
    }>;
  };
  onViewCustomer?: (customer: any) => void;
}

export const EnterpriseGroupModal = ({ open, onClose, groupData, onViewCustomer }: EnterpriseGroupModalProps) => {
  const [notes, setNotes] = useState<Note[]>(groupData.notes || []);
  const [todos, setTodos] = useState<Todo[]>(groupData.todos || []);
  const [newNote, setNewNote] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [newTodoDueDate, setNewTodoDueDate] = useState("");

  const addNote = () => {
    if (!newNote.trim()) return;
    
    const note: Note = {
      id: `N${Date.now()}`,
      content: newNote,
      timestamp: new Date().toLocaleString(),
      author: "Current User"
    };
    
    setNotes([note, ...notes]);
    setNewNote("");
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    
    const todo: Todo = {
      id: `T${Date.now()}`,
      task: newTodo,
      completed: false,
      dueDate: newTodoDueDate || new Date().toISOString().split('T')[0]
    };
    
    setTodos([...todos, todo]);
    setNewTodo("");
    setNewTodoDueDate("");
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Building2 className="h-5 w-5" />
            <span className="text-sm">Enterprise Summary</span>
          </div>
          <DialogTitle className="text-2xl">{groupData.enterpriseGroup}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="todos">To-Do ({todos.filter(t => !t.completed).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Section A - Enterprise Summary */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Enterprise Overview</h3>
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BAN</span>
                      <Badge variant="outline">{groupData.ban}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account</span>
                      <span className="font-medium">{groupData.enterpriseAccount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subaccount</span>
                      <span className="font-medium">{groupData.enterpriseSubaccount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Site</span>
                      <span className="font-medium">{groupData.site}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Total Outstanding</span>
                      </div>
                      <p className="text-2xl font-bold text-red-500">${groupData.totalOutstanding.toLocaleString()}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Total Paid</span>
                      </div>
                      <p className="text-2xl font-bold text-green-500">${groupData.totalPaid.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Total Disputed</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-500">${groupData.totalDisputed.toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Cases</span>
                        <p className="font-semibold">{groupData.totalCases}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Users</span>
                        <p className="font-semibold">{groupData.totalUsers}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Risk Score</span>
                    <span className="font-semibold">{groupData.avgRiskScore.toFixed(1)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Days Past Due</span>
                    <span className="font-semibold">{groupData.avgDaysPastDue.toFixed(0)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Largest Invoice</span>
                    <span className="font-semibold">{groupData.largestInvoice}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Top 5 MSISDNs by Debt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupData.topMSISDNs.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="font-medium">{item.msisdn}</span>
                      <span className="font-semibold text-red-500">${item.debt.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section B - Customer Table */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Individual Cases Under This BAN</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>MSISDN</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Disputed</TableHead>
                    <TableHead>Payments</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>DPD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupData.customers.map((customer, index) => (
                    <TableRow key={index} className="hover:bg-muted/50 cursor-pointer">
                      <TableCell className="font-medium">{customer.customerName}</TableCell>
                      <TableCell>{customer.msisdn}</TableCell>
                      <TableCell>{customer.invoiceNo}</TableCell>
                      <TableCell className="text-red-500">${customer.outstanding.toLocaleString()}</TableCell>
                      <TableCell className="text-orange-500">${customer.disputed.toLocaleString()}</TableCell>
                      <TableCell className="text-green-500">${customer.paid.toLocaleString()}</TableCell>
                      <TableCell>{customer.riskScore}</TableCell>
                      <TableCell>{customer.daysPastDue}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{customer.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {customer.agentName && (
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium">{customer.agentName.charAt(0)}</span>
                            </div>
                            <span className="text-sm">{customer.agentName}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onViewCustomer?.(customer)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add New Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Enter your note here..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <Button onClick={addNote} size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {notes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No notes yet. Add your first note above.
                  </CardContent>
                </Card>
              ) : (
                notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{note.author}</p>
                            <p className="text-xs text-muted-foreground">{note.timestamp}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm mt-2 ml-10">{note.content}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="todos" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add New Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Task description..."
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newTodoDueDate}
                    onChange={(e) => setNewTodoDueDate(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={addTodo} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {todos.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No tasks yet. Add your first task above.
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Active Tasks */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground px-2">Active Tasks</h3>
                    {todos.filter(t => !t.completed).map((todo) => (
                      <Card key={todo.id} className="hover:bg-muted/50 transition-colors">
                        <CardContent className="py-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={todo.completed}
                              onCheckedChange={() => toggleTodo(todo.id)}
                            />
                            <Circle className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{todo.task}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">Due: {todo.dueDate}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {todos.filter(t => !t.completed).length === 0 && (
                      <p className="text-sm text-muted-foreground px-2 py-4 text-center">No active tasks</p>
                    )}
                  </div>

                  {/* Completed Tasks */}
                  {todos.filter(t => t.completed).length > 0 && (
                    <div className="space-y-2 mt-6">
                      <h3 className="text-sm font-medium text-muted-foreground px-2">Completed Tasks</h3>
                      {todos.filter(t => t.completed).map((todo) => (
                        <Card key={todo.id} className="opacity-60">
                          <CardContent className="py-3">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={todo.completed}
                                onCheckedChange={() => toggleTodo(todo.id)}
                              />
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <div className="flex-1">
                                <p className="text-sm line-through">{todo.task}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <p className="text-xs text-muted-foreground">Due: {todo.dueDate}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
