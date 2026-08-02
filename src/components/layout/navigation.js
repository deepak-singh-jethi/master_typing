import {
  BarChart3,
  BookOpen,
  Gauge,
  LayoutDashboard,
  Settings,
  TimerReset,
} from "lucide-react";

export const navigationItems = [
  { to: "/", label: "Today", icon: LayoutDashboard, end: true },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: Gauge },
  { to: "/tests", label: "Tests", icon: TimerReset },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const mobileNavigationItems = navigationItems.filter((item) => item.to !== "/settings");
