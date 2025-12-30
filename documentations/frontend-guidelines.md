# Frontend Development Guidelines
## GabonNews WhatsApp SaaS

### 1. Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── ui/                # Shadcn/ui components
│   ├── features/          # Feature-specific components
│   ├── layouts/           # Layout components
│   └── shared/            # Shared components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions
├── services/              # API service functions
├── stores/                # Zustand stores
├── styles/                # Global styles
├── types/                 # TypeScript definitions
└── utils/                 # Helper functions
```

### 2. HTML Standards

#### Semantic HTML
```html
<!-- ✅ Good: Semantic structure -->
<header>
  <nav aria-label="Navigation principale">
    <ul>
      <li><a href="/tableau-de-bord">Tableau de bord</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Titre de l'article</h1>
    <section>
      <h2>Résumé</h2>
      <p>Contenu...</p>
    </section>
  </article>
</main>

<footer>
  <p>&copy; 2024 GabonNews</p>
</footer>

<!-- ❌ Bad: Non-semantic -->
<div class="header">
  <div class="nav">...</div>
</div>
```

#### Accessibility
```html
<!-- Form accessibility -->
<form>
  <label for="keywords">Mots-clés de veille</label>
  <input 
    id="keywords" 
    type="text"
    aria-describedby="keywords-help"
    aria-required="true"
    placeholder="Ex: économie, pétrole, OPEP"
  />
  <span id="keywords-help">Séparez les mots-clés par des virgules</span>
</form>

<!-- Images -->
<img 
  src="/logo.png" 
  alt="GabonNews - Actualités gabonaises sur WhatsApp"
  loading="lazy"
/>

<!-- Buttons -->
<button 
  type="button"
  aria-label="Ouvrir le menu"
  aria-expanded="false"
>
  <svg>...</svg>
</button>
```

### 3. CSS/Tailwind Standards

#### Tailwind Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          500: '#22c55e',  // Green for WhatsApp theme
          900: '#14532d',
        },
        gabon: {
          green: '#009e49',
          blue: '#3a75c4',
          yellow: '#fcd116',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      }
    }
  }
}
```

#### Component Styling
```tsx
// ✅ Good: Organized Tailwind classes
export function NewsCard({ article }: NewsCardProps) {
  return (
    <article className={cn(
      // Base styles
      "rounded-lg border bg-card p-6",
      // Responsive
      "sm:p-8 lg:p-10",
      // Dark mode
      "dark:bg-gray-800 dark:border-gray-700",
      // Hover effects
      "transition-all duration-200",
      "hover:shadow-lg hover:scale-[1.02]",
      // Focus states
      "focus-within:ring-2 focus-within:ring-primary-500"
    )}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {article.title}
      </h2>
      <p className="text-gray-600 dark:text-gray-300 line-clamp-3">
        {article.summary}
      </p>
    </article>
  );
}

// ❌ Bad: Inconsistent styling
<div className="rounded-lg p-6 border bg-card hover:shadow-lg dark:bg-gray-800 sm:p-8 dark:border-gray-700 transition-all lg:p-10">
```

#### CSS Modules for Complex Styles
```scss
// styles/Dashboard.module.scss
.dashboard {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }

  &__sidebar {
    position: sticky;
    top: 1rem;
    height: fit-content;
  }

  &__content {
    min-height: calc(100vh - 4rem);
  }
}
```

### 4. JavaScript/TypeScript Best Practices

#### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

#### Type Definitions
```typescript
// types/article.ts
export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: Date;
  category: Category;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  imageUrl?: string;
}

export interface UserPreferences {
  language: 'fr' | 'en';
  categories: Category[];
  keywords: string[];
  deliveryTime: 'instant' | 'hourly' | 'daily';
  timezone: string;
}

// ✅ Good: Strict typing
export async function fetchArticles(
  filters: ArticleFilters
): Promise<ApiResponse<Article[]>> {
  try {
    const response = await api.get<Article[]>('/articles', { params: filters });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error as ApiError };
  }
}
```

#### Component Patterns
```tsx
// ✅ Good: Clean component with proper typing
interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  isActive?: boolean;
  onSelect: (planId: string) => void;
}

export function SubscriptionCard({ 
  plan, 
  isActive = false, 
  onSelect 
}: SubscriptionCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className={cn(
      "relative rounded-2xl p-8 transition-all",
      isActive ? "border-2 border-primary-500 shadow-xl" : "border border-gray-200"
    )}>
      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white px-3 py-1 rounded-full text-sm">
          Plus populaire
        </span>
      )}
      <h3 className="text-2xl font-bold mb-4">{plan.name}</h3>
      <p className="text-4xl font-bold mb-6">
        {formatPrice(plan.price)}
        <span className="text-base font-normal text-gray-500">/mois</span>
      </p>
      <Button
        onClick={() => onSelect(plan.id)}
        variant={isActive ? "default" : "outline"}
        className="w-full"
      >
        {isActive ? "Plan actuel" : "Sélectionner"}
      </Button>
    </div>
  );
}

// ❌ Bad: Any types and poor structure
function Card({data}: any) {
  return <div onClick={() => data.fn(data.id)}>{data.title}</div>
}
```

#### Custom Hooks
```typescript
// hooks/useSubscription.ts
export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription()
      .then(setSubscription)
      .finally(() => setLoading(false));
  }, []);

  const upgrade = useCallback(async (planId: string) => {
    const result = await api.post('/subscription/upgrade', { planId });
    if (result.success) {
      setSubscription(result.data);
    }
    return result;
  }, []);

  return { subscription, loading, upgrade };
}

// hooks/useKeywordMonitoring.ts
export function useKeywordMonitoring() {
  const { data, mutate } = useSWR('/api/keywords', fetcher);

  const addKeyword = useCallback(async (keyword: string) => {
    await api.post('/api/keywords', { keyword });
    mutate();
  }, [mutate]);

  return {
    keywords: data?.keywords || [],
    addKeyword,
    removeKeyword,
    isLoading: !data,
  };
}
```

### 5. State Management with Zustand

```typescript
// stores/userStore.ts
interface UserStore {
  user: User | null;
  preferences: UserPreferences;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  preferences: DEFAULT_PREFERENCES,
  isAuthenticated: false,

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    set({ 
      user: data.user, 
      isAuthenticated: true,
      preferences: data.preferences,
    });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
    router.push('/');
  },

  updatePreferences: (prefs) => {
    set((state) => ({
      preferences: { ...state.preferences, ...prefs }
    }));
    api.patch('/user/preferences', prefs);
  },
}));
```

### 6. API Integration

```typescript
// services/api.ts
class ApiService {
  private baseURL = process.env.NEXT_PUBLIC_API_URL;
  private token: string | null = null;

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof ApiError ? error : new ApiError(500, 'Network error') 
      };
    }
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiService();
```

### 7. Form Handling

```tsx
// components/features/KeywordForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const keywordSchema = z.object({
  keywords: z.string()
    .min(2, 'Au moins 2 caractères requis')
    .max(100, 'Maximum 100 caractères')
    .refine((val) => val.split(',').length <= 20, {
      message: 'Maximum 20 mots-clés autorisés',
    }),
  category: z.enum(['all', 'politics', 'economy', 'sports', 'culture']),
  alertFrequency: z.enum(['instant', 'hourly', 'daily']),
});

type KeywordFormData = z.infer<typeof keywordSchema>;

export function KeywordForm({ onSubmit }: { onSubmit: (data: KeywordFormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<KeywordFormData>({
    resolver: zodResolver(keywordSchema),
    defaultValues: {
      category: 'all',
      alertFrequency: 'daily',
    },
  });

  const onSubmitForm = async (data: KeywordFormData) => {
    await onSubmit(data);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
      <div>
        <label htmlFor="keywords" className="block text-sm font-medium mb-2">
          Mots-clés de veille
        </label>
        <input
          {...register('keywords')}
          type="text"
          id="keywords"
          className={cn(
            "w-full px-4 py-2 border rounded-lg",
            "focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            errors.keywords && "border-red-500"
          )}
          placeholder="politique, économie, OPEP..."
        />
        {errors.keywords && (
          <p className="mt-1 text-sm text-red-600">{errors.keywords.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement...' : 'Configurer la veille'}
      </Button>
    </form>
  );
}
```

### 8. Performance Optimization

```tsx
// Lazy loading components
const DashboardAnalytics = lazy(() => import('./DashboardAnalytics'));

// Image optimization
import Image from 'next/image';

export function ArticleCard({ article }: { article: Article }) {
  return (
    <div>
      <Image
        src={article.imageUrl}
        alt={article.title}
        width={400}
        height={250}
        loading="lazy"
        placeholder="blur"
        blurDataURL={article.imagePlaceholder}
      />
    </div>
  );
}

// Memoization
export const ExpensiveComponent = memo(({ data }: Props) => {
  const processedData = useMemo(() => 
    expensiveCalculation(data), [data]
  );
  
  return <div>{processedData}</div>;
});

// Virtual scrolling for long lists
import { FixedSizeList } from 'react-window';

export function ArticleList({ articles }: { articles: Article[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ArticleCard article={articles[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={articles.length}
      itemSize={150}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 9. Internationalization

```tsx
// lib/i18n.ts
export const messages = {
  fr: {
    welcome: 'Bienvenue sur GabonNews',
    subscribe: "S'abonner",
    dashboard: 'Tableau de bord',
    keywords: 'Mots-clés',
    settings: 'Paramètres',
    logout: 'Déconnexion',
    plans: {
      free: 'Gratuit',
      premium: 'Premium',
      enterprise: 'Entreprise',
    },
  },
  en: {
    welcome: 'Welcome to GabonNews',
    subscribe: 'Subscribe',
    dashboard: 'Dashboard',
    keywords: 'Keywords',
    settings: 'Settings',
    logout: 'Logout',
    plans: {
      free: 'Free',
      premium: 'Premium',
      enterprise: 'Enterprise',
    },
  },
};

// Usage in component
export function Header() {
  const { locale } = useRouter();
  const t = messages[locale as keyof typeof messages];

  return (
    <header>
      <h1>{t.welcome}</h1>
      <nav>
        <Link href="/dashboard">{t.dashboard}</Link>
      </nav>
    </header>
  );
}
```

### 10. Testing Standards

```typescript
// __tests__/components/SubscriptionCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SubscriptionCard } from '@/components/SubscriptionCard';

describe('SubscriptionCard', () => {
  const mockPlan = {
    id: '1',
    name: 'Premium',
    price: 2500,
    features: ['Unlimited articles'],
  };

  it('renders plan details correctly', () => {
    render(<SubscriptionCard plan={mockPlan} onSelect={jest.fn()} />);
    
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText(/2.500 FCFA/)).toBeInTheDocument();
  });

  it('calls onSelect when button is clicked', () => {
    const handleSelect = jest.fn();
    render(<SubscriptionCard plan={mockPlan} onSelect={handleSelect} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleSelect).toHaveBeenCalledWith('1');
  });
});
```

### 11. Error Boundaries

```tsx
// components/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Send to Sentry
    captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Une erreur est survenue</h1>
            <Button onClick={() => window.location.reload()}>
              Rafraîchir la page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 12. Code Review Checklist

- [ ] TypeScript types are properly defined (no `any`)
- [ ] Components are properly memoized where needed
- [ ] Forms have proper validation and error handling
- [ ] Accessibility attributes are present (aria-labels, roles)
- [ ] Responsive design is implemented
- [ ] Dark mode styles are included
- [ ] Loading and error states are handled
- [ ] Code follows naming conventions
- [ ] No console.logs in production code
- [ ] Translations are provided for all user-facing text