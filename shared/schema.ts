import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define the categories as const
export const RECIPE_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "desserts",
  "drinks",
  "other"
] as const;

// User schema from original file
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Recipe schema
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  cookTimeMinutes: integer("cook_time_minutes").notNull(),
  ingredients: jsonb("ingredients").notNull().$type<string[]>(),
  steps: jsonb("steps").notNull().$type<string[]>(),
  notes: text("notes"),
  imageUrl: text("image_url"),
  createdAt: text("created_at").notNull(),
});

// Create Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const recipeSchema = createInsertSchema(recipes);

export const insertRecipeSchema = recipeSchema.omit({
  id: true,
}).extend({
  category: z.enum(RECIPE_CATEGORIES),
  ingredients: z.array(z.string().min(1, "Ingredient cannot be empty")),
  steps: z.array(z.string().min(1, "Step cannot be empty")),
  cookTimeMinutes: z.number().min(1, "Cooking time must be at least 1 minute"),
  createdAt: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

// Form schema with image for front-end validation
export const recipeFormSchema = insertRecipeSchema.extend({
  image: z.instanceof(File).optional(),
});

export type RecipeForm = z.infer<typeof recipeFormSchema>;
