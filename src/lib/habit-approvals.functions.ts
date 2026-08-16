import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const requestHabitApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        habitId: z.string().uuid(),
        date: z.string().min(1).max(10),
        imagePaths: z.array(z.string().min(1).max(500)).min(1).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify habit belongs to the requesting child and was created by a parent
    const { data: habit, error: hErr } = await supabaseAdmin
      .from("habits")
      .select("user_id, created_by")
      .eq("id", data.habitId)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!habit) throw new Error("Habit not found");
    if (habit.user_id !== context.userId) throw new Error("Forbidden");
    if (!habit.created_by || habit.created_by === context.userId) {
      throw new Error("Cette tâche n'a pas été donnée par un parent.");
    }

    // Verify link exists
    const { data: link } = await supabaseAdmin
      .from("parent_child_links")
      .select("id")
      .eq("parent_user_id", habit.created_by)
      .eq("child_user_id", context.userId)
      .maybeSingle();
    if (!link) throw new Error("Parent non lié.");

    const { error } = await supabaseAdmin.from("habit_approvals").insert({
      habit_id: data.habitId,
      child_user_id: context.userId,
      parent_user_id: habit.created_by,
      date: data.date,
      image_path: data.imagePaths[0]!,
      image_paths: data.imagePaths,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("habit_approvals")
      .select("id, habit_id, date, status")
      .eq("child_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPendingApprovalsForParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: approvals, error } = await supabaseAdmin
      .from("habit_approvals")
      .select("id, habit_id, child_user_id, date, image_path, image_paths, status, created_at")
      .eq("parent_user_id", context.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    if (!approvals || approvals.length === 0) return [];

    const habitIds = [...new Set(approvals.map((a) => a.habit_id))];
    const childIds = [...new Set(approvals.map((a) => a.child_user_id))];
    const [{ data: habits }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("habits").select("id, name").in("id", habitIds),
      supabaseAdmin.from("profiles").select("id, display_name").in("id", childIds),
    ]);
    const habitMap = new Map((habits ?? []).map((h) => [h.id, h.name]));
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    const results = await Promise.all(
      approvals.map(async (a) => {
        const paths =
          a.image_paths && a.image_paths.length > 0 ? a.image_paths : [a.image_path];
        const signedList = await Promise.all(
          paths.map(async (p) => {
            const { data: signed } = await supabaseAdmin.storage
              .from("habit-proofs")
              .createSignedUrl(p, 3600);
            return signed?.signedUrl ?? null;
          }),
        );
        const imageUrls = signedList.filter((u): u is string => !!u);
        return {
          id: a.id,
          habitId: a.habit_id,
          habitName: habitMap.get(a.habit_id) ?? "Tâche",
          childId: a.child_user_id,
          childName: profMap.get(a.child_user_id) ?? "Enfant",
          date: a.date,
          imageUrl: imageUrls[0] ?? null,
          imageUrls,
          createdAt: a.created_at,
        };
      }),
    );
    return results;
  });

export const reviewHabitApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        approvalId: z.string().uuid(),
        approve: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: approval, error } = await supabaseAdmin
      .from("habit_approvals")
      .select("id, habit_id, date, parent_user_id, status")
      .eq("id", data.approvalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!approval) throw new Error("Demande introuvable");
    if (approval.parent_user_id !== context.userId) throw new Error("Forbidden");
    if (approval.status !== "pending") throw new Error("Déjà traité");

    const newStatus = data.approve ? "approved" : "rejected";
    const { error: uErr } = await supabaseAdmin
      .from("habit_approvals")
      .update({ status: newStatus, reviewed_at: new Date().toISOString() })
      .eq("id", data.approvalId);
    if (uErr) throw new Error(uErr.message);

    if (data.approve) {
      const { data: habit } = await supabaseAdmin
        .from("habits")
        .select("completions")
        .eq("id", approval.habit_id)
        .maybeSingle();
      const current = habit?.completions ?? [];
      if (!current.includes(approval.date)) {
        const next = [...current, approval.date];
        const { error: hErr } = await supabaseAdmin
          .from("habits")
          .update({ completions: next })
          .eq("id", approval.habit_id);
        if (hErr) throw new Error(hErr.message);
      }
    }
    return { ok: true, status: newStatus };
  });
