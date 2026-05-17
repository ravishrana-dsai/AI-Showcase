# Running Parallel Servers (3002 & 3003)

This project now supports running multiple instances simultaneously on different ports.

## Current Status

✅ **Both servers are currently running:**
- http://localhost:3002
- http://localhost:3003

## Quick Start Options

### Option 1: Run Both Servers Automatically
```bash
./start-both.sh
```
This starts both servers in parallel. Press `Ctrl+C` to stop both.

### Option 2: Run Individual Servers

**Start on Port 3002:**
```bash
./start-3002.sh
# OR
npm run dev:3002
```

**Start on Port 3003:**
```bash
./start-3003.sh
# OR
npm run dev:3003
```

### Option 3: Manual Port Control
```bash
PORT=3002 npm run dev  # Any port you want
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Default server (port 3000) |
| `npm run dev:3002` | Server on port 3002 |
| `npm run dev:3003` | Server on port 3003 |
| `./start-both.sh` | Both servers in parallel |
| `./start-3002.sh` | Single server on 3002 |
| `./start-3003.sh` | Single server on 3003 |

## Use Cases

### Why Run Multiple Servers?

1. **A/B Testing**: Compare different features side-by-side
2. **Development**: Test changes without losing your current working version
3. **Demo**: Show different versions to stakeholders simultaneously
4. **Debugging**: Reproduce issues in one instance while debugging in another

## Managing Running Servers

### Check Which Ports Are Active
```bash
lsof -ti:3002,3003
```

### Stop a Specific Port
```bash
# Find the process
lsof -ti:3002

# Kill the process (replace PID with actual process ID)
kill <PID>
```

### Stop All Next.js Servers
```bash
pkill -f "next dev"
```

## Troubleshooting

### Port Already in Use
If you see "Port already in use" error:
```bash
# Find what's using the port
lsof -ti:3002

# Kill the process
kill $(lsof -ti:3002)
```

### Too Many Open Files Warning
If you see "EMFILE: too many open files" warnings:
- This is normal when running multiple Next.js instances
- The servers still work fine
- To fix permanently, increase your system's file descriptor limit:
  ```bash
  ulimit -n 10240
  ```

### Servers Won't Start
1. Check if dependencies are installed: `npm install`
2. Check if `.env.local` exists (copy from `.env.local.example`)
3. Verify Node.js is installed: `node -v`

## Notes

- Each server runs independently with its own hot-reload
- Changes to code will reflect in both servers
- Each server maintains its own dev state
- API keys are shared from `.env.local`

## Original Start Script

The original `./start.sh` still works and runs the server on port 3000.
