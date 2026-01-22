'use client';

import { X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LaunchTab } from './admin/launch-tab';
import { TokenManagementTab } from './admin/token-management-tab';

interface AdminDashboardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminDashboardOverlay({ isOpen, onClose }: AdminDashboardOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div
        className={`absolute top-0 right-0 h-full w-full bg-black transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-purple-400/20">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-purple-400 hover:bg-purple-400/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profile
              </Button>
              <h1 className="text-2xl font-bold text-purple-400 font-libre-caslon">
                Admin Dashboard
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[#DCDDCC] hover:bg-purple-400/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <Tabs defaultValue="launch" className="w-full">
              <TabsList className="bg-transparent border-none p-0 h-auto space-x-6 mb-6 flex-wrap">
                <TabsTrigger
                  value="launch"
                  className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
                >
                  Token Launch
                </TabsTrigger>
                <TabsTrigger
                  value="token-management"
                  className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
                >
                  Token Management
                </TabsTrigger>
              </TabsList>
              <TabsContent value="launch" className="mt-6 w-full">
                <LaunchTab />
              </TabsContent>
              <TabsContent value="token-management" className="mt-6 w-full">
                <TokenManagementTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
