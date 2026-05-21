import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { nodes, edges, start, end } = data;

    // Build the input string for the C++ binary
    // Format:
    // N M
    // u v w
    // start end
    let input = `${nodes} ${edges.length}\n`;
    for (const edge of edges) {
      input += `${edge.u} ${edge.v} ${edge.w}\n`;
    }
    input += `${start} ${end}\n`;

    // Path to the executable (assuming we are running from web_dashboard in dev mode)
    const executablePath = path.resolve('../cpp_engine/dijkstra_router');

    return new Promise((resolve) => {
      const child = exec(executablePath, (error, stdout, stderr) => {
        if (error) {
          console.error("Exec error:", error);
          return resolve(NextResponse.json({ error: 'Failed to run algorithm', details: error.message }, { status: 500 }));
        }
        
        try {
          const parsed = JSON.parse(stdout);
          resolve(NextResponse.json(parsed));
        } catch (e) {
          console.error("JSON parse error:", e);
          console.error("Raw output:", stdout);
          resolve(NextResponse.json({ error: 'Failed to parse algorithm output', raw: stdout }, { status: 500 }));
        }
      });

      // Write the input to the child process stdin
      if (child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
