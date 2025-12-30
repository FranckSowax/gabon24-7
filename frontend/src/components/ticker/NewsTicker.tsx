'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, AlertTriangle, Radio, X, MoreVertical, Zap } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface TickerMessage {
  id: string;
  reformulated_title: string;
  article_url: string;
  source_name: string;
  author: string;
  is_urgent: boolean;
  priority: number;
}

export default function NewsTicker() {
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(6.8); // pixels per second - 15% slower than 8
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 1x, 1.5x, 2x, 3x, 4x
  const [currentSource, setCurrentSource] = useState<string>('');
  const [isVisible, setIsVisible] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<any>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 60000); // Refresh every minute

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('ticker_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticker_messages'
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu && event.target && (event.target as Element).closest && !(event.target as Element).closest('.relative')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('ticker_messages')
      .select('*')
      .eq('is_active', true)
      .gte('display_end', new Date().toISOString())
      .order('is_urgent', { ascending: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      // Éliminer les doublons basés sur le titre reformulé
      const uniqueMessages = data.filter((message: any, index: number, self: any[]) => 
        index === self.findIndex((m: any) => m.reformulated_title === message.reformulated_title)
      );
      setMessages(uniqueMessages);
    }
  };

  const trackClick = async (messageId: string) => {
    await supabase
      .from('ticker_logs')
      .insert({
        message_id: messageId,
        event_type: 'clicked'
      });

    // Increment click count
    const { data: currentMessage } = await supabase
      .from('ticker_messages')
      .select('click_count')
      .eq('id', messageId)
      .single();
    
    if (currentMessage) {
      await supabase
        .from('ticker_messages')
        .update({ click_count: (currentMessage.click_count || 0) + 1 })
        .eq('id', messageId);
    }
  };

  const handleSpeedChange = (multiplier: number) => {
    setSpeedMultiplier(multiplier);
    setShowMenu(false);
  };

  const getSpeedOptions = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    return isMobile 
      ? [{ label: '1.5x', value: 1.5 }, { label: '2x', value: 2 }, { label: '3x', value: 3 }]
      : [{ label: '1.5x', value: 1.5 }, { label: '2x', value: 2 }, { label: '3x', value: 3 }];
  };

  if (!isVisible || messages.length === 0) return null;

  return (
    <div className="relative w-full bg-gray-900 border-y border-gray-700 overflow-visible h-12 sm:h-10">
      {/* Source Badge - Mobile Responsive */}
      <div className="absolute left-0 top-0 bottom-0 z-20 bg-gradient-to-r from-gray-900 via-gray-900 to-transparent pr-4 sm:pr-8">
        <div className="h-full flex items-center px-2 sm:px-4">
          <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-orange-600 rounded text-xs sm:text-sm">
            <Radio className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" />
            <span className="font-semibold whitespace-nowrap hidden sm:inline">
              INFOS LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Menu Dropdown - Mobile & Desktop */}
      <div className="absolute right-2 top-0 bottom-0 z-30 flex items-center">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 sm:p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            aria-label="Menu"
          >
            <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]"
                style={{ position: 'absolute', zIndex: 9999 }}
              >
                {/* Pause/Play */}
                <button
                  onClick={() => {
                    setIsPaused(!isPaused);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-3 h-3" />
                      Reprendre
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" />
                      Pause
                    </>
                  )}
                </button>

                {/* Speed Options */}
                <div className="border-t border-gray-600 my-1"></div>
                <div className="px-3 py-1 text-xs text-gray-400 font-medium">Vitesse</div>
                
                <button
                  onClick={() => handleSpeedChange(1)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${
                    speedMultiplier === 1 ? 'text-orange-400' : 'text-white'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  Normal (1x)
                </button>

                {getSpeedOptions().map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSpeedChange(option.value)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${
                      speedMultiplier === option.value ? 'text-orange-400' : 'text-white'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    Rapide ({option.label})
                  </button>
                ))}

                {/* Close */}
                <div className="border-t border-gray-600 my-1"></div>
                <button
                  onClick={() => {
                    setIsVisible(false);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                >
                  <X className="w-3 h-3" />
                  Fermer
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages Container - Mobile Responsive */}
      <div 
        ref={tickerRef}
        className="relative h-12 sm:h-10 flex items-center justify-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <motion.div
          className="flex items-center justify-center gap-4 sm:gap-8 whitespace-nowrap text-sm sm:text-base pl-20 pr-20 sm:pl-52 sm:pr-20 h-full"
          animate={{
            x: isPaused ? undefined : '-100%'
          }}
          transition={{
            x: {
              duration: messages.length * 60 / (speed * speedMultiplier),
              ease: "linear",
              repeat: Infinity,
              repeatType: "loop"
            }
          }}
        >
          {/* Triple messages for seamless infinite loop */}
          {[...messages, ...messages, ...messages].map((message, index) => (
            <Link
              key={`${message.id}-${index}`}
              href={message.article_url || '#'}
              target="_blank"
              onClick={() => trackClick(message.id)}
              onMouseEnter={() => setCurrentSource(message.source_name)}
              className="inline-flex items-center gap-2 hover:text-orange-400 transition-colors"
            >
              {message.is_urgent && (
                <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
              )}
              <span className={`text-sm ${message.is_urgent ? 'text-red-400 font-semibold' : 'text-white'}`}>
                {message.reformulated_title}
              </span>
              {message.author && (
                <>
                  <span className="text-gray-500 text-xs">•</span>
                  <span className="text-gray-400 text-xs">
                    {message.author}
                  </span>
                </>
              )}
              <span className="text-gray-500 text-xs">•</span>
            </Link>
          ))}
        </motion.div>
      </div>

    </div>
  );
}
