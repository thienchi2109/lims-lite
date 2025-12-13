[
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.results` has multiple permissive policies for role `anon` for action `INSERT`. Policies include `{\"Analysts can insert pending results\",\"Managers can insert results\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "results",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_results_anon_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.results` has multiple permissive policies for role `anon` for action `UPDATE`. Policies include `{\"Analysts can update non-review results\",\"Managers can update results\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "results",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_results_anon_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.results` has multiple permissive policies for role `authenticated` for action `INSERT`. Policies include `{\"Analysts can insert pending results\",\"Managers can insert results\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "results",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_results_authenticated_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.results` has multiple permissive policies for role `authenticated` for action `UPDATE`. Policies include `{\"Analysts can update non-review results\",\"Managers can update results\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "results",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_results_authenticated_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.samples` has multiple permissive policies for role `anon` for action `INSERT`. Policies include `{\"Analysts can insert own samples\",\"Managers can insert samples\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "samples",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_samples_anon_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.samples` has multiple permissive policies for role `anon` for action `UPDATE`. Policies include `{\"Analysts can start samples\",\"Analysts can update own samples\",\"Managers can update samples\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "samples",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_samples_anon_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.samples` has multiple permissive policies for role `authenticated` for action `INSERT`. Policies include `{\"Analysts can insert own samples\",\"Managers can insert samples\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "samples",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_samples_authenticated_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same `role` and `action` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table `public.samples` has multiple permissive policies for role `authenticated` for action `UPDATE`. Policies include `{\"Analysts can start samples\",\"Analysts can update own samples\",\"Managers can update samples\"}`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "samples",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_samples_authenticated_UPDATE"
  }
]