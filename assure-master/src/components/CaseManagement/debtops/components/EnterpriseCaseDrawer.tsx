import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Phone, FileText, DollarSign, TrendingUp, List, User, Plus, CheckCircle2, Circle, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface EnterpriseCaseDrawerProps {
  open: boolean;
  onClose: () => void;
  caseData: {
    employeeName: string;
    companyName: string;
    ban: string;
    msisdn?: string;
    invoiceNo: string;
    caseCategory: string;
    caseType: string;
    amountDisputed: number;
    agentName?: string;
    notes?: Note[];
    todos?: Todo[];
  };
}

export const EnterpriseCaseDrawer = ({ open, onClose, caseData }: EnterpriseCaseDrawerProps) => {
  const [notes, setNotes] = useState<Note[]>(caseData.notes || []);
  const [todos, setTodos] = useState<Todo[]>(caseData.todos || []);
  const [newNote, setNewNote] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [newTodoDueDate, setNewTodoDueDate] = useState("");

  const getCaseTypeColor = (type: string) => {
    if (type.toLowerCase().includes('ban')) {
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    }
    return 'bg-green-500/10 text-green-500 border-green-500/20';
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    
    const note: Note = {
      id: `N${Date.now()}`,
      content: newNote,
      timestamp: new Date().toLocaleString(),
      author: caseData.agentName || "Current User"
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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">{caseData.companyName}</span>
          </div>
          <SheetTitle className="text-2xl">{caseData.employeeName}</SheetTitle>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={getCaseTypeColor(caseData.caseType)}>{caseData.caseType}</Badge>
            <Badge variant="outline">{caseData.caseCategory}</Badge>
            {caseData.agentName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {caseData.agentName}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="todos">To-Do ({todos.filter(t => !t.completed).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Company Hierarchy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Hierarchy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">{caseData.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BAN</span>
                  <span className="font-medium">{caseData.ban}</span>
                </div>
                {caseData.msisdn && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MSISDN</span>
                    <span className="font-medium">{caseData.msisdn}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice No</span>
                  <span className="font-medium">{caseData.invoiceNo}</span>
                </div>
              </CardContent>
            </Card>

            {/* Debt Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Debt Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Disputed</span>
                  <span className="font-semibold text-red-500">${caseData.amountDisputed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Outstanding</span>
                  <span className="font-semibold">${(caseData.amountDisputed * 1.5).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-semibold text-green-500">$500.00</span>
                </div>
              </CardContent>
            </Card>

            {/* Case History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Case History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Case Opened</p>
                      <p className="text-xs text-muted-foreground">March 22, 2024 - Initial dispute filed</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Investigation Started</p>
                      <p className="text-xs text-muted-foreground">March 23, 2024 - Assigned to billing team</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>March 15, 2024</TableCell>
                      <TableCell>$500.00</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>February 10, 2024</TableCell>
                      <TableCell>$300.00</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">Completed</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
      </SheetContent>
    </Sheet>
  );
};