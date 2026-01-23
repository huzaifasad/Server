'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Edit2, 
  Trash2, 
  Eye 
} from 'lucide-react';
import CronJobForm from './components/CronJobForm';
import ExecutionLogs from './components/ExecutionLogs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.buythelook.us';

export default function CronsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    nextRun: null
  });

  // Fetch all cron jobs
  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_URL}/api/cron/jobs`);
      const data = await response.json();
      
      if (data.success) {
        setJobs(data.jobs || []);
        
        // Calculate stats
        const active = data.jobs?.filter(j => j.is_active).length || 0;
        const upcoming = data.jobs?.find(j => j.next_run_at)?.next_run_at;
        
        setStats({
          totalJobs: data.jobs?.length || 0,
          activeJobs: active,
          nextRun: upcoming
        });
      }
    } catch (error) {
      console.error('[v0] Failed to fetch cron jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (jobId) => {
    if (!confirm('Delete this cron job?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/cron/jobs/${jobId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        setJobs(jobs.filter(j => j.id !== jobId));
      }
    } catch (error) {
      console.error('[v0] Failed to delete job:', error);
    }
  };

  const handleTrigger = async (jobId) => {
    try {
      const response = await fetch(`${API_URL}/api/cron/jobs/${jobId}/trigger`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        alert('Cron job triggered! Check the execution logs.');
      }
    } catch (error) {
      console.error('[v0] Failed to trigger job:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-base font-bold tracking-tight">ASOS Scraper</h1>
              <nav className="flex gap-1">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="h-7 text-xs font-medium">
                    Scraper
                  </Button>
                </Link>
                <Link href="/products">
                  <Button variant="ghost" size="sm" className="h-7 text-xs font-medium">
                    Products
                  </Button>
                </Link>
                <Link href="/crons">
                  <Button variant="default" size="sm" className="h-7 text-xs font-medium">
                    Schedules
                  </Button>
                </Link>
              </nav>
            </div>
            <Button 
              onClick={() => setShowForm(!showForm)} 
              size="sm" 
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              New Schedule
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalJobs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeJobs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Next Run</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs">
                {stats.nextRun 
                  ? new Date(stats.nextRun).toLocaleString().split(',')[1].trim()
                  : 'None scheduled'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Form */}
        {showForm && (
          <Card className="mb-4 border-blue-200">
            <CardHeader>
              <CardTitle className="text-sm">Create New Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <CronJobForm 
                onSuccess={() => {
                  setShowForm(false);
                  fetchJobs();
                }}
                onCancel={() => setShowForm(false)}
              />
            </CardContent>
          </Card>
        )}

        {/* Jobs List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading schedules...
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No schedules created yet</p>
              <Button 
                onClick={() => setShowForm(true)} 
                size="sm" 
                className="mt-3 h-7 text-xs"
              >
                Create First Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <Card key={job.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xs font-semibold truncate">{job.name}</h3>
                        <Badge 
                          variant={job.is_active ? 'default' : 'secondary'} 
                          className="text-xs h-5"
                        >
                          {job.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.category_paths?.length || 0} categories • {job.schedule_type} at {job.schedule_time}
                      </p>
                      {job.last_run_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last run: {new Date(job.last_run_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => handleTrigger(job.id)}
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        title="Run now"
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => setSelectedJob(job)}
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        title="View logs"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 bg-transparent"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(job.id)}
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Execution Logs Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader className="sticky top-0 bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{selectedJob.name} - Execution Logs</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {selectedJob.total_runs || 0} runs • Last: {selectedJob.last_run_at ? new Date(selectedJob.last_run_at).toLocaleString() : 'Never'}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setSelectedJob(null)}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ExecutionLogs jobId={selectedJob.id} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
