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
import { 
  Phone, 
  FileText, 
  AlertCircle, 
  TrendingUp, 
  MessageSquare, 
  DollarSign,
  User,
  Plus,
  CheckCircle2,
  Circle,
  Clock
} from "lucide-react";

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

interface ConsumerCaseDrawerProps {
  open: boolean;
  onClose: () => void;
  caseData: {
    customerName: string;
    msisdn: string;
    invoiceNo: string;
    caseCategory: string;
    status: string;
    amountDisputed: number;
    riskScore: number;
    daysPastDue: number;
    agentName?: string;
    notes?: Note[];
    todos?: Todo[];
  };
}

export const ConsumerCaseDrawer = ({ open, onClose, caseData }: ConsumerCaseDrawerProps) => {
  const [notes, setNotes] = useState<Note[]>(caseData.notes || []);
  const [todos, setTodos] = useState<Todo[]>(caseData.todos || []);
  const [newNote, setNewNote] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [newTodoDueDate, setNewTodoDueDate] = useState("");

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-muted text-muted-foreground';
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'in progress':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'closed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
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
          <SheetTitle className="text-2xl">{caseData.customerName}</SheetTitle>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={getStatusColor(caseData.status)}>{caseData.status}</Badge>
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
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MSISDN</span>
                  <span className="font-medium">{caseData.msisdn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice No</span>
                  <span className="font-medium">{caseData.invoiceNo}</span>
                </div>
              </CardContent>
            </Card>

            {/* Financial Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Disputed</span>
                  <span className="font-semibold text-red-500">${caseData.amountDisputed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="font-semibold">{caseData.riskScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days Past Due</span>
                  <span className="font-semibold">{caseData.daysPastDue}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">$250.00</p>
                      <p className="text-xs text-muted-foreground">March 15, 2024</p>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">Completed</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">$180.00</p>
                      <p className="text-xs text-muted-foreground">February 10, 2024</p>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">Completed</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Communication History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Communication History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Email Sent</p>
                      <p className="text-xs text-muted-foreground">March 20, 2024 - Payment reminder</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Call Attempted</p>
                      <p className="text-xs text-muted-foreground">March 18, 2024 - No answer</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Customer shows high contactability (85%) and has honored 3 out of 4 payment promises. 
                  Recommended action: Send payment reminder with flexible payment plan options.
                </p>
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