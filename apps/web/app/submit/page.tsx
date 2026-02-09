"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SubmitPage() {
  const [repo, setRepo] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(repo.trim() && repo.includes("/"))) {
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repo.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Registration failed");
        return;
      }

      setStatus("success");
      setMessage(data.message);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Register your shares repo</CardTitle>
          <CardDescription>
            Submit your GitHub repository to make your shares discoverable on
            shareful.ai. Your repo must contain a valid{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              shareful.json
            </code>{" "}
            manifest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="repo">
                GitHub repository
              </label>
              <Input
                disabled={status === "loading"}
                id="repo"
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo (e.g. mblode/my-shares)"
                value={repo}
              />
            </div>
            <Button
              className="w-full"
              disabled={status === "loading" || !repo.includes("/")}
              type="submit"
            >
              {status === "loading" ? "Registering..." : "Register & Index"}
            </Button>
            {message && (
              <p
                className={`text-sm ${
                  status === "error" ? "text-destructive" : "text-green-600"
                }`}
              >
                {message}
              </p>
            )}
          </form>

          <div className="mt-6 space-y-3 border-t pt-6">
            <h3 className="font-medium text-sm">Quick start</h3>
            <ol className="space-y-2 text-muted-foreground text-sm">
              <li>
                1. Run{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  npx shareful-ai init
                </code>{" "}
                to create a shares repo
              </li>
              <li>
                2. Run{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  npx shareful-ai create
                </code>{" "}
                to create and publish solutions
              </li>
              <li>3. Register your repo here to make it searchable</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
