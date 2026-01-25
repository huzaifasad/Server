import express from "express";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import cors from "cors";
import { WebSocketServer } from 'ws';
import http from 'http';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

// Import scraper modules
import { 
  ASOS_CATEGORIES, 
  scrapeASOS, 
  buildCategoryBreadcrumb 
} from './scrapers/asosScraper.js';

import { 
  MANGO_CATEGORIES, 
  scrapeMango, 
  buildMangoCategoryBreadcrumb 
} from './scrapers/mangoScraper.js';

import { 
  FOREVER21_CATEGORIES, 
  scrapeForever21 
} from './scrapers/forever21Scraper.js';

import { 
  ALLBIRDS_CATEGORIES, 
  scrapeAllbirds 
} from './scrapers/allbirdsScraper.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware - MUST come before routes
app.use(cors({ origin: "*" }));
app.use(express.json());

// Store active WebSocket connections
const clients = new Map();

// Store active cron job schedulers
const cronSchedulers = new Map();

// Cron execution stats for current run
let currentCronStats = {
  productsAdded: 0,
  productsUpdated: 0,
  productsFailed: 0,
  cronLogId: null
};

// Store cron jobs
const cronJobs = new Map();

// Calculate next run time based on schedule (Pakistan Time - Asia/Karachi)
function calculateNextRun(scheduleType, scheduleTime) {
  if (!scheduleTime || typeof scheduleTime !== 'string') {
    console.error('[v0] Invalid scheduleTime:', scheduleTime);
    throw new Error('scheduleTime is required and must be a string in format HH:MM');
  }
  
  // Get current time in Pakistan timezone (Asia/Karachi - UTC+5)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const [hours, minutes] = scheduleTime.split(':');
  
  if (!hours || !minutes) {
    throw new Error('scheduleTime must be in format HH:MM');
  }
  
  // Create next run time in Pakistan timezone
  const next = new Date(now);
  next.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  if (scheduleType === 'every_3_days') {
    next.setDate(next.getDate() + 2);
  } else if (scheduleType === 'weekly') {
    next.setDate(next.getDate() + 6);
  }
  
  return next.toISOString();
}

// Convert schedule to cron expression (uses Pakistan timezone directly in cron.schedule)
function getCronExpression(scheduleType, scheduleTime) {
  if (!scheduleTime || typeof scheduleTime !== 'string') {
    console.error('[v0] Invalid scheduleTime in getCronExpression:', scheduleTime);
    throw new Error('scheduleTime is required and must be a string in format HH:MM');
  }
  
  const [hours, minutes] = scheduleTime.split(':');
  
  if (!hours || !minutes) {
    throw new Error('scheduleTime must be in format HH:MM');
  }
  
  console.log(`[v0] Creating cron for ${hours}:${minutes} Pakistan Time`);
  
  switch (scheduleType) {
    case 'daily':
      return `${minutes} ${hours} * * *`;
    case 'every_3_days':
      return `${minutes} ${hours} */3 * *`;
    case 'weekly':
      return `${minutes} ${hours} * * 0`; // Sunday
    default:
      return `${minutes} ${hours} * * *`;
  }
}

// Load and schedule all active cron jobs on server start
async function loadAndScheduleCronJobs() {
  try {
    const { data: jobs, error } = await supabase
      .from('scraper_cron_jobs')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    console.log(`📅 Loading ${jobs?.length || 0} active cron jobs...`);
    
    for (const job of jobs || []) {
      scheduleCronJob(job);
    }
  } catch (error) {
    console.error('❌ Failed to load cron jobs:', error.message);
  }
}

// Schedule a cron job
function scheduleCronJob(job) {
  const cronExpression = getCronExpression(job.schedule_type, job.schedule_time);
  
  // Use timezone option to run in Asia/Karachi timezone
  const task = cron.schedule(cronExpression, async () => {
    console.log(`⏰ Executing cron job: ${job.name} (Pakistan Time: ${job.schedule_time})`);
    await executeCronJob(job.id);
  }, {
    timezone: 'Asia/Karachi'
  });
  
  cronSchedulers.set(job.id, task);
  console.log(`✓ Scheduled cron job "${job.name}" at ${job.schedule_time} Pakistan Time (cron: ${cronExpression})`);
}

// Execute a cron job with timeout and error recovery
async function executeCronJob(jobId, isManual = false) {
  const TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours max
  const STATS_UPDATE_INTERVAL = 60 * 1000; // Update stats every 60 seconds
  
  let timeoutId;
  let statsUpdateInterval;
  let logEntry;
  
  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('scraper_cron_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error('Cron job not found:', jobId);
      return;
    }
    
    console.log(`[v0] Executing cron job "${job.name}" (${job.scraper_type}) with ${job.category_paths?.length} categories`);
    
    // Create execution log
    const { data: log, error: logError } = await supabase
      .from('scraper_cron_logs')
      .insert({
        cron_job_id: jobId,
        scraper_type: job.scraper_type,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (logError) {
      console.error('[v0] Failed to create cron log:', logError);
      return;
    }
    
    logEntry = log;
    console.log(`[v0] Created cron log entry ID: ${logEntry.id}`);
    
    currentCronStats = {
      productsAdded: 0,
      productsUpdated: 0,
      productsFailed: 0,
      cronLogId: logEntry.id
    };
    
    const startTime = Date.now();
    const categoriesProcessed = [];
    
    // Setup timeout to prevent jobs running forever
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Cron job timeout after ${TIMEOUT_MS / 1000 / 60} minutes`));
      }, TIMEOUT_MS);
    });
    
    // Setup periodic stats updates during long scrapes
    statsUpdateInterval = setInterval(async () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const totalScraped = currentCronStats.productsAdded + currentCronStats.productsUpdated;
      
      console.log(`[v0] Heartbeat update: ${totalScraped} products, ${duration}s elapsed`);
      
      await supabase
        .from('scraper_cron_logs')
        .update({
          duration_seconds: duration,
          total_products_scraped: totalScraped,
          products_added: currentCronStats.productsAdded,
          products_updated: currentCronStats.productsUpdated,
          products_failed: currentCronStats.productsFailed,
          categories_processed: categoriesProcessed
        })
        .eq('id', logEntry.id);
    }, STATS_UPDATE_INTERVAL);
    
    broadcastProgress({
      type: 'info',
      message: `🔄 Cron job "${job.name}" started (${job.category_paths.length} categories)`,
      cronId: jobId
    });
    
    // Determine which scraper to use
    let scrapeFunction, breadcrumbFunction;
    if (job.scraper_type === 'mango') {
      console.log('[v0] Using Mango scraper');
      scrapeFunction = scrapeMango;
      breadcrumbFunction = buildMangoCategoryBreadcrumb;
    } else if (job.scraper_type === 'forever21') {
      console.log('[v0] Using Forever21 scraper');
      scrapeFunction = scrapeForever21;
      breadcrumbFunction = (path) => path.split(' > ').map(p => {
        const parts = path.split(' > ');
        let current = FOREVER21_CATEGORIES;
        for (const part of parts) {
          if (current[part]) return current[part].name;
          current = current[part]?.subcategories || {};
        }
        return path;
      }).join(' > ');
    } else if (job.scraper_type === 'allbirds') {
      console.log('[v0] Using Allbirds scraper');
      scrapeFunction = scrapeAllbirds;
      breadcrumbFunction = (path) => path.split(' > ').map(p => {
        const parts = path.split(' > ');
        let current = ALLBIRDS_CATEGORIES;
        for (const part of parts) {
          if (current[part]) return current[part].name;
          current = current[part]?.subcategories || {};
        }
        return path;
      }).join(' > ');
    } else {
      console.log('[v0] Using ASOS scraper');
      scrapeFunction = scrapeASOS;
      breadcrumbFunction = buildCategoryBreadcrumb;
    }
    
    // Wrap scraping in timeout promise
    const scrapingPromise = (async () => {
      // PERFORMANCE OPTIMIZATION: Parallel category processing (4-6 categories at once for 8 CPU)
      const PARALLEL_CATEGORIES = 4; // Adjust based on server resources (safe for 8 CPU/16GB)
      const categoryChunks = [];
      
      for (let i = 0; i < job.category_paths.length; i += PARALLEL_CATEGORIES) {
        categoryChunks.push(job.category_paths.slice(i, i + PARALLEL_CATEGORIES));
      }
      
      console.log(`[v0] Processing ${job.category_paths.length} categories in ${categoryChunks.length} parallel batches (${PARALLEL_CATEGORIES} at a time)`);
      
      // Process each chunk of categories in parallel
      for (const chunk of categoryChunks) {
        const chunkPromises = chunk.map(async (categoryPath) => {
          try {
            console.log(`[v0] Scraping category: ${categoryPath}`);
            
            // Create a broadcast wrapper that includes cronId for log tracking
            const cronBroadcast = (data) => {
              broadcastProgress({
                ...data,
                cronId: jobId,
                cronJobName: job.name,
                category: categoryPath
              });
            };
            
            const results = await scrapeFunction(
              null,
              categoryPath,
              {
                mode: job.scrape_mode,
                limit: job.limit_value,
                startIndex: job.start_index,
                endIndex: job.end_index
              },
              job.concurrency || 8, // Increase per-category concurrency too (8 products at once)
              cronBroadcast,
              currentCronStats
            );
            
            // Handle different return formats: array (ASOS/Mango) or object with successful/failed (Forever21)
            let productsCount = 0;
            if (Array.isArray(results)) {
              productsCount = results.length;
            } else if (results?.successful) {
              productsCount = results.successful.length;
            }
            
            console.log(`[v0] Scraped ${categoryPath}: ${productsCount} products (Stats: ${currentCronStats.productsAdded} added, ${currentCronStats.productsUpdated} updated, ${currentCronStats.productsFailed} failed)`);
            
            categoriesProcessed.push({
              path: categoryPath,
              name: breadcrumbFunction(categoryPath),
              products: productsCount,
              status: 'success'
            });
            
            return { categoryPath, success: true, productsCount };
          } catch (error) {
            console.error(`[v0] Failed to scrape ${categoryPath}:`, error.message, error.stack);
            categoriesProcessed.push({
              path: categoryPath,
              name: breadcrumbFunction(categoryPath),
              products: 0,
              status: 'failed',
              error: error.message
            });
            
            return { categoryPath, success: false, error: error.message };
          }
        });
        
        // Wait for all categories in this chunk to complete before moving to next chunk
        const chunkResults = await Promise.all(chunkPromises);
        console.log(`[v0] Completed batch: ${chunkResults.filter(r => r.success).length}/${chunkResults.length} categories successful`);
      }
    })();
    
    // Race between scraping and timeout
    await Promise.race([scrapingPromise, timeoutPromise]);
    
    // Clear intervals and timeouts
    clearTimeout(timeoutId);
    clearInterval(statsUpdateInterval);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    const totalScraped = currentCronStats.productsAdded + currentCronStats.productsUpdated;
    
    // Update log with results
    await supabase
      .from('scraper_cron_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
        total_products_scraped: totalScraped,
        products_added: currentCronStats.productsAdded,
        products_updated: currentCronStats.productsUpdated,
        products_failed: currentCronStats.productsFailed,
        categories_processed: categoriesProcessed
      })
      .eq('id', logEntry.id);
    
    // Update job stats
    const nextRun = calculateNextRun(job.schedule_type, job.schedule_time);
    await supabase
      .from('scraper_cron_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun,
        total_runs: job.total_runs + 1,
        consecutive_failures: 0
      })
      .eq('id', jobId);
    
    broadcastProgress({
      type: 'success',
      message: `✅ Cron job "${job.name}" completed: ${totalScraped} products (${currentCronStats.productsAdded} new, ${currentCronStats.productsUpdated} updated)`,
      cronId: jobId
    });
    
    // Send email notifications
    console.log(`[v0] Email check: notify_on_success=${job.notify_on_success}, email_recipients=${JSON.stringify(job.email_recipients)}, length=${job.email_recipients?.length || 0}`);
    if (job.notify_on_success && job.email_recipients.length > 0) {
      console.log(`[v0] Sending email to ${job.email_recipients.length} recipients...`);
      await sendCronEmailReport(job, logEntry.id, categoriesProcessed, duration);
      console.log(`[v0] Email sent successfully!`);
    } else {
      console.log(`[v0] Email NOT sent - notify_on_success: ${job.notify_on_success}, recipients: ${job.email_recipients?.length || 0}`);
    }
  } catch (error) {
    console.error('Cron execution failed:', error);
    
    // Update log with failure
    await supabase
      .from('scraper_cron_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', currentCronStats.cronLogId);
    
    // Handle retry logic
    const { data: job } = await supabase
      .from('scraper_cron_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (job && job.auto_retry && job.consecutive_failures < job.max_retries) {
      // Schedule retry
      setTimeout(() => executeCronJob(jobId), job.retry_delay_minutes * 60 * 1000);
      
      await supabase
        .from('scraper_cron_jobs')
        .update({
          consecutive_failures: job.consecutive_failures + 1
        })
        .eq('id', jobId);
    } else if (job && job.notify_on_failure && job.email_recipients.length > 0) {
      // Send failure email
      await sendCronFailureEmail(job, error.message);
    }
  } finally {
    clearTimeout(timeoutId);
    clearInterval(statsUpdateInterval);
  }
}

// Send cron job email report
async function sendCronEmailReport(job, logId, categories, durationSeconds) {
  const { data: log } = await supabase
    .from('scraper_cron_logs')
    .select('*')
    .eq('id', logId)
    .single();
  
  if (!log) return;
  
  const durationFormatted = `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000; color: #fff; padding: 20px; text-align: center; }
        .stats { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .stat-item { display: inline-block; margin: 10px 20px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #000; }
        .stat-label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #000; color: #fff; }
        .success { color: #22c55e; }
        .failed { color: #ef4444; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Scraping Job Completed</h2>
          <p>${job.name}</p>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <div class="stat-value">${log.total_products_scraped}</div>
            <div class="stat-label">Total Products</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${log.products_added}</div>
            <div class="stat-label">New Products</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${log.products_updated}</div>
            <div class="stat-label">Updated</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${durationFormatted}</div>
            <div class="stat-label">Duration</div>
          </div>
        </div>
        
        <h3>📁 Categories Processed</h3>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Products</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(cat => `
              <tr>
                <td>${cat.name}</td>
                <td>${cat.products}</td>
                <td class="${cat.status === 'success' ? 'success' : 'failed'}">
                  ${cat.status === 'success' ? '✓' : '✗'} ${cat.status}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Started: ${new Date(log.started_at).toLocaleString()}<br>
          Completed: ${new Date(log.completed_at).toLocaleString()}
        </p>
      </div>
    </body>
    </html>
  `;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });

  for (const email of job.email_recipients) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✅ Cron Job Complete: ${job.name}`,
        html: htmlContent
      });
    } catch (error) {
      console.error('[v0] Cron job execution error:', error);
      
      // Clear intervals
      if (timeoutId) clearTimeout(timeoutId);
      if (statsUpdateInterval) clearInterval(statsUpdateInterval);
      
      // Mark log as failed
      if (logEntry) {
        const duration = Math.round((Date.now() - (Date.parse(logEntry.started_at))) / 1000);
        await supabase
          .from('scraper_cron_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_seconds: duration,
            total_products_scraped: currentCronStats?.productsAdded + currentCronStats?.productsUpdated || 0,
            products_added: currentCronStats?.productsAdded || 0,
            products_updated: currentCronStats?.productsUpdated || 0,
            products_failed: currentCronStats?.productsFailed || 0,
            error_message: error.message
          })
          .eq('id', logEntry.id);
      }
      
      broadcastProgress({
        type: 'error',
        message: `❌ Cron job failed: ${error.message}`,
        cronId: jobId
      });
    }
  }
}

// Send cron failure email
async function sendCronFailureEmail(job, errorMessage) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: #fff; padding: 20px; text-align: center; }
        .error { background: #fee; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ef4444; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>❌ Scraping Job Failed</h2>
          <p>${job.name}</p>
        </div>
        <div class="error">
          <p><strong>Error:</strong> ${errorMessage}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });

  for (const email of job.email_recipients) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `❌ Cron Job Failed: ${job.name}`,
        html: htmlContent
      });
    } catch (error) {
      console.error(`Failed to send failure email to ${email}:`, error);
    }
  }
}

// Initialize Supabase with service role key (bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// WebSocket connection handling
wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substring(7);
  clients.set(clientId, ws);
  console.log(`Client ${clientId} connected`);

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
  });

  ws.send(JSON.stringify({ 
    type: 'connected', 
    message: 'Connected to scraper WebSocket',
    clientId 
  }));
});

// Broadcast progress to all connected WebSocket clients (with console logging)
function broadcastProgress(data) {
  // Console log all broadcasts for server monitoring
  const logPrefix = {
    'info': '[ℹ️ INFO]',
    'success': '[✅ SUCCESS]',
    'error': '[❌ ERROR]',
    'warning': '[⚠️ WARNING]',
    'progress': '[🔄 PROGRESS]',
    'complete': '[✔️ COMPLETE]'
  }[data.type] || '[📢 BROADCAST]';
  
  console.log(`${logPrefix} ${data.message}`, data.category ? `(${data.category})` : '');
  
  // Send to WebSocket clients
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// Email transporter
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Send email notification
async function sendEmailNotification(recipientEmail, summary) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.log('Email credentials not configured');
    return { success: false, error: 'Email not configured' };
  }
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Scraping Complete</h2>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
        <p><strong>Total Products:</strong> ${summary.totalProducts}</p>
        <p><strong>Successful:</strong> ${summary.successfulProducts}</p>
        <p><strong>Failed:</strong> ${summary.failedProducts}</p>
        <p><strong>Categories Scraped:</strong> ${summary.categoriesScraped}</p>
        <p><strong>Duration:</strong> ${summary.duration}</p>
      </div>
      ${summary.categories && summary.categories.length > 0 ? `
        <h3>Categories:</h3>
        <ul>
          ${summary.categories.map(cat => `<li>${cat.name}${cat.productsScraped ? `: ${cat.productsScraped} products` : ''}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
  
  try {
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: 'Scraping Complete',
      html: htmlContent
    });
    return { success: true };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// ASOS API ROUTES
// ========================================

  // Get ASOS categories
  app.get('/asos/categories', (req, res) => {
    res.json({
      success: true,
      categories: ASOS_CATEGORIES
    });
  });

// Scrape ASOS single category
app.post('/scrape/category', async (req, res) => {
  const { categoryPath, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPath) {
    return res.status(400).json({ success: false, error: 'categoryPath is required' });
  }

  res.json({ 
    success: true, 
    message: 'ASOS scraping started', 
    categoryPath 
  });

  (async () => {
    const startTime = Date.now();
    try {
      const results = await scrapeASOS(
        null,
        categoryPath,
        { mode, limit, startIndex, endIndex },
        concurrency || 5,
        broadcastProgress
      );

      const duration = Math.round((Date.now() - startTime) / 1000);
      const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

      if (email) {
        await sendEmailNotification(email, {
          totalProducts: results.length,
          successfulProducts: results.length,
          failedProducts: 0,
          categoriesScraped: 1,
          categories: [{ name: buildCategoryBreadcrumb(categoryPath), productsScraped: results.length }],
          duration: durationFormatted
        });
      }

      broadcastProgress({
        type: 'success',
        message: `ASOS scraping completed! ${results.length} products in ${durationFormatted}`
      });
    } catch (err) {
      broadcastProgress({
        type: 'error',
        message: `ASOS scraping failed: ${err.message}`
      });
    }
  })();
});

// Scrape ASOS bulk categories
app.post('/scrape/bulk', async (req, res) => {
  const { categoryPaths, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPaths || !Array.isArray(categoryPaths) || categoryPaths.length === 0) {
    return res.status(400).json({ success: false, error: 'categoryPaths array is required' });
  }

  res.json({ 
    success: true, 
    message: 'ASOS bulk scraping started',
    categoriesCount: categoryPaths.length
  });

  (async () => {
    const startTime = Date.now();
    let totalProducts = 0;
    const categories = [];

    for (const categoryPath of categoryPaths) {
      try {
        const results = await scrapeASOS(
          null,
          categoryPath,
          { mode, limit, startIndex, endIndex },
          concurrency || 5,
          broadcastProgress
        );
        totalProducts += results.length;
        categories.push({ 
          name: buildCategoryBreadcrumb(categoryPath), 
          productsScraped: results.length 
        });
      } catch (err) {
        broadcastProgress({
          type: 'error',
          message: `Error scraping ASOS ${categoryPath}: ${err.message}`
        });
        categories.push({ 
          name: buildCategoryBreadcrumb(categoryPath), 
          productsScraped: 0 
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

    if (email) {
      await sendEmailNotification(email, {
        totalProducts,
        successfulProducts: totalProducts,
        failedProducts: 0,
        categoriesScraped: categoryPaths.length,
        categories,
        duration: durationFormatted
      });
    }

    broadcastProgress({
      type: 'success',
      message: `ASOS bulk scraping completed! ${totalProducts} products from ${categoryPaths.length} categories in ${durationFormatted}`
    });
  })();
});

// ========================================
// MANGO API ROUTES
// ========================================

// Get Mango categories
app.get('/mango/categories', (req, res) => {
  res.json({ 
    success: true, 
    categories: MANGO_CATEGORIES 
  });
});

// Scrape Mango single category
app.post('/mango/scrape/category', async (req, res) => {
  const { categoryPath, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPath) {
    return res.status(400).json({ success: false, error: 'categoryPath is required' });
  }

  res.json({ 
    success: true, 
    message: 'Mango scraping started', 
    categoryPath 
  });

  (async () => {
    const startTime = Date.now();
    try {
      const results = await scrapeMango(
        null,
        categoryPath,
        { mode, limit, startIndex, endIndex },
        concurrency || 5,
        broadcastProgress
      );

      const duration = Math.round((Date.now() - startTime) / 1000);
      const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

      if (email) {
        await sendEmailNotification(email, {
          totalProducts: results.length,
          successfulProducts: results.length,
          failedProducts: 0,
          categoriesScraped: 1,
          categories: [{ name: buildMangoCategoryBreadcrumb(categoryPath), productsScraped: results.length }],
          duration: durationFormatted
        });
      }

      broadcastProgress({
        type: 'success',
        message: `Mango scraping completed! ${results.length} products in ${durationFormatted}`
      });
    } catch (err) {
      broadcastProgress({
        type: 'error',
        message: `Mango scraping failed: ${err.message}`
      });
    }
  })();
});

// Scrape Mango bulk categories
app.post('/mango/scrape/bulk', async (req, res) => {
  const { categoryPaths, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPaths || !Array.isArray(categoryPaths) || categoryPaths.length === 0) {
    return res.status(400).json({ success: false, error: 'categoryPaths array is required' });
  }

  res.json({ 
    success: true, 
    message: 'Mango bulk scraping started',
    categoriesCount: categoryPaths.length
  });

  (async () => {
    const startTime = Date.now();
    let totalProducts = 0;
    const categories = [];

    for (const categoryPath of categoryPaths) {
      try {
        const results = await scrapeMango(
          null,
          categoryPath,
          { mode, limit, startIndex, endIndex },
          concurrency || 5,
          broadcastProgress
        );
        totalProducts += results.length;
        categories.push({ 
          name: buildMangoCategoryBreadcrumb(categoryPath), 
          productsScraped: results.length 
        });
      } catch (err) {
        broadcastProgress({
          type: 'error',
          message: `Error scraping Mango ${categoryPath}: ${err.message}`
        });
        categories.push({ 
          name: buildMangoCategoryBreadcrumb(categoryPath), 
          productsScraped: 0 
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

    if (email) {
      await sendEmailNotification(email, {
        totalProducts,
        successfulProducts: totalProducts,
        failedProducts: 0,
        categoriesScraped: categoryPaths.length,
        categories,
        duration: durationFormatted
      });
    }

    broadcastProgress({
      type: 'success',
      message: `Mango bulk scraping completed! ${totalProducts} products from ${categoryPaths.length} categories in ${durationFormatted}`
    });
  })();
});

// ========================================
// CRON JOB API ROUTES
// ========================================

// Create new cron job
app.post('/api/cron/jobs', async (req, res) => {
  try {
    console.log('[v0] Received cron job creation request:', req.body);
    
    // Transform camelCase from frontend to snake_case for database
    const scheduleType = req.body.scheduleType || req.body.schedule_type;
    const scheduleTime = req.body.scheduleTime || req.body.schedule_time;
    const categoryPaths = req.body.categoryPaths || req.body.category_paths;
    const scraperType = req.body.scraperType || req.body.scraper_type;
    
    // Validate required fields
    if (!scheduleType) {
      return res.status(400).json({ success: false, error: 'scheduleType is required' });
    }
    if (!scheduleTime) {
      return res.status(400).json({ success: false, error: 'scheduleTime is required (format: HH:MM)' });
    }
    if (!categoryPaths || !Array.isArray(categoryPaths) || categoryPaths.length === 0) {
      return res.status(400).json({ success: false, error: 'categoryPaths array is required' });
    }
    
    // Build database-compatible object with snake_case
    const jobData = {
      name: req.body.name,
      description: req.body.description || '',
      scraper_type: scraperType,
      category_paths: categoryPaths,
      schedule_type: scheduleType,
      schedule_time: scheduleTime,
      scrape_mode: req.body.scrapeMode || req.body.scrape_mode || 'full',
      limit_value: req.body.limitValue || req.body.limit_value,
      start_index: req.body.startIndex || req.body.start_index,
      end_index: req.body.endIndex || req.body.end_index,
      concurrency: req.body.concurrency || 5,
      email_recipients: req.body.emailRecipients || req.body.email_recipients || [],
      notify_on_success: req.body.notifyOnSuccess !== undefined ? req.body.notifyOnSuccess : (req.body.notify_on_success || false),
      notify_on_failure: req.body.notifyOnFailure !== undefined ? req.body.notifyOnFailure : (req.body.notify_on_failure || false),
      auto_retry: req.body.autoRetry !== undefined ? req.body.autoRetry : (req.body.auto_retry || false),
      max_retries: req.body.maxRetries || req.body.max_retries || 3,
      retry_delay_minutes: req.body.retryDelayMinutes || req.body.retry_delay_minutes || 30,
      is_active: req.body.isActive !== undefined ? req.body.isActive : (req.body.is_active !== undefined ? req.body.is_active : true),
      created_at: new Date().toISOString(),
      next_run_at: calculateNextRun(scheduleType, scheduleTime),
      total_runs: 0,
      consecutive_failures: 0
    };

    const { data, error } = await supabase
      .from('scraper_cron_jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) throw error;

    if (data.is_active) {
      scheduleCronJob(data);
    }

    res.json({ success: true, job: data });
  } catch (error) {
    console.error('Failed to create cron job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all cron jobs
app.get('/api/cron/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scraper_cron_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, jobs: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single cron job
app.get('/api/cron/jobs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scraper_cron_jobs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json({ success: true, job: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update cron job
app.put('/api/cron/jobs/:id', async (req, res) => {
  try {
    const { data: existingJob } = await supabase
      .from('scraper_cron_jobs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (req.body.schedule_type || req.body.schedule_time) {
      req.body.next_run_at = calculateNextRun(
        req.body.schedule_type || existingJob.schedule_type,
        req.body.schedule_time || existingJob.schedule_time
      );
    }

    const { data, error } = await supabase
      .from('scraper_cron_jobs')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Reschedule if active
    if (cronSchedulers.has(req.params.id)) {
      cronSchedulers.get(req.params.id).stop();
      cronSchedulers.delete(req.params.id);
    }

    if (data.is_active) {
      scheduleCronJob(data);
    }

    res.json({ success: true, job: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete cron job
app.delete('/api/cron/jobs/:id', async (req, res) => {
  try {
    if (cronSchedulers.has(req.params.id)) {
      cronSchedulers.get(req.params.id).stop();
      cronSchedulers.delete(req.params.id);
    }

    const { error } = await supabase
      .from('scraper_cron_jobs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger cron job manually
app.post('/api/cron/jobs/:id/trigger', async (req, res) => {
  try {
    res.json({ success: true, message: 'Cron job triggered' });
    executeCronJob(req.params.id, true);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cron job execution logs
app.get('/api/cron/jobs/:id/logs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scraper_cron_logs')
      .select('*')
      .eq('cron_job_id', req.params.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ success: true, logs: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// FOREVER 21 API ROUTES (Shopify-based)
// ========================================

// Get Forever 21 categories
app.get('/forever21/categories', (req, res) => {
  res.json({ 
    success: true, 
    categories: FOREVER21_CATEGORIES 
  });
});

// Scrape Forever 21 single category
app.post('/forever21/scrape/category', async (req, res) => {
  const { categoryPath, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPath) {
    return res.status(400).json({ success: false, error: 'categoryPath is required' });
  }

  res.json({ 
    success: true, 
    message: 'Forever 21 scraping started (Shopify API)', 
    categoryPath 
  });

  (async () => {
    const startTime = Date.now();
    try {
      const results = await scrapeForever21(
        null,
        categoryPath,
        { mode, limit, startIndex, endIndex },
        concurrency || 5,
        broadcastProgress
      );

      const duration = Math.round((Date.now() - startTime) / 1000);
      const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

      if (email) {
        await sendEmailNotification(email, {
          totalProducts: results.successful?.length || 0,
          successfulProducts: results.successful?.length || 0,
          failedProducts: results.failed?.length || 0,
          categoriesScraped: 1,
          categories: [{ name: categoryPath, productsScraped: results.successful?.length || 0 }],
          duration: durationFormatted
        });
      }

      broadcastProgress({
        type: 'success',
        message: `Forever 21 scraping completed! ${results.successful?.length || 0} products in ${durationFormatted}`
      });
    } catch (err) {
      broadcastProgress({
        type: 'error',
        message: `Forever 21 scraping failed: ${err.message}`
      });
    }
  })();
});

// Scrape Forever 21 bulk categories
app.post('/forever21/scrape/bulk', async (req, res) => {
  const { categoryPaths, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPaths || !Array.isArray(categoryPaths) || categoryPaths.length === 0) {
    return res.status(400).json({ success: false, error: 'categoryPaths array is required' });
  }

  res.json({ 
    success: true, 
    message: 'Forever 21 bulk scraping started (Shopify API)',
    categoriesCount: categoryPaths.length
  });

  (async () => {
    const startTime = Date.now();
    let totalProducts = 0;
    const categories = [];

    for (const categoryPath of categoryPaths) {
      try {
        const results = await scrapeForever21(
          null,
          categoryPath,
          { mode, limit, startIndex, endIndex },
          concurrency || 5,
          broadcastProgress
        );
        const successCount = results.successful?.length || 0;
        totalProducts += successCount;
        categories.push({ 
          name: categoryPath, 
          productsScraped: successCount 
        });
      } catch (err) {
        broadcastProgress({
          type: 'error',
          message: `Error scraping Forever 21 ${categoryPath}: ${err.message}`
        });
        categories.push({ 
          name: categoryPath, 
          productsScraped: 0 
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

    if (email) {
      await sendEmailNotification(email, {
        totalProducts,
        successfulProducts: totalProducts,
        failedProducts: 0,
        categoriesScraped: categoryPaths.length,
        categories,
        duration: durationFormatted
      });
    }

    broadcastProgress({
      type: 'success',
      message: `Forever 21 bulk scraping completed! ${totalProducts} products from ${categoryPaths.length} categories in ${durationFormatted}`
    });
  })();
});

// ========================================
// ALLBIRDS API ROUTES (Shopify-based)
// ========================================

// Get Allbirds categories
app.get('/allbirds/categories', (req, res) => {
  res.json({ 
    success: true, 
    categories: ALLBIRDS_CATEGORIES 
  });
});

// Scrape Allbirds single category
app.post('/allbirds/scrape/category', async (req, res) => {
  const { categoryPath, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPath) {
    return res.status(400).json({ success: false, error: 'categoryPath is required' });
  }

  res.json({ 
    success: true, 
    message: 'Allbirds scraping started (Shopify API)', 
    categoryPath 
  });

  (async () => {
    const startTime = Date.now();
    try {
      const results = await scrapeAllbirds(
        null,
        categoryPath,
        { mode, limit, startIndex, endIndex },
        concurrency || 5,
        broadcastProgress
      );

      const duration = Math.round((Date.now() - startTime) / 1000);
      const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

      if (email) {
        await sendEmailNotification(email, {
          totalProducts: results.successful?.length || 0,
          successfulProducts: results.successful?.length || 0,
          failedProducts: results.failed?.length || 0,
          categoriesScraped: 1,
          categories: [{ name: categoryPath, productsScraped: results.successful?.length || 0 }],
          duration: durationFormatted
        });
      }

      broadcastProgress({
        type: 'success',
        message: `Allbirds scraping completed! ${results.successful?.length || 0} products in ${durationFormatted}`
      });
    } catch (err) {
      broadcastProgress({
        type: 'error',
        message: `Allbirds scraping failed: ${err.message}`
      });
    }
  })();
});

// Scrape Allbirds bulk categories
app.post('/allbirds/scrape/bulk', async (req, res) => {
  const { categoryPaths, mode, limit, startIndex, endIndex, concurrency, email } = req.body;

  if (!categoryPaths || !Array.isArray(categoryPaths) || categoryPaths.length === 0) {
    return res.status(400).json({ success: false, error: 'categoryPaths array is required' });
  }

  res.json({ 
    success: true, 
    message: 'Allbirds bulk scraping started (Shopify API)',
    categoriesCount: categoryPaths.length
  });

  (async () => {
    const startTime = Date.now();
    let totalProducts = 0;
    const categories = [];

    for (const categoryPath of categoryPaths) {
      try {
        const results = await scrapeAllbirds(
          null,
          categoryPath,
          { mode, limit, startIndex, endIndex },
          concurrency || 5,
          broadcastProgress
        );
        const successCount = results.successful?.length || 0;
        totalProducts += successCount;
        categories.push({ 
          name: categoryPath, 
          productsScraped: successCount 
        });
      } catch (err) {
        broadcastProgress({
          type: 'error',
          message: `Error scraping Allbirds ${categoryPath}: ${err.message}`
        });
        categories.push({ 
          name: categoryPath, 
          productsScraped: 0 
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const durationFormatted = `${Math.floor(duration / 60)}m ${duration % 60}s`;

    if (email) {
      await sendEmailNotification(email, {
        totalProducts,
        successfulProducts: totalProducts,
        failedProducts: 0,
        categoriesScraped: categoryPaths.length,
        categories,
        duration: durationFormatted
      });
    }

    broadcastProgress({
      type: 'success',
      message: `Allbirds bulk scraping completed! ${totalProducts} products from ${categoryPaths.length} categories in ${durationFormatted}`
    });
  })();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeCronJobs: cronSchedulers.size,
    activeWebSocketClients: clients.size
  });
});

// Start server and load cron jobs
const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  await loadAndScheduleCronJobs();
});
