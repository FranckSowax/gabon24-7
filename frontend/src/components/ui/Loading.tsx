import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function Loading({ size = 'md', text, className = '' }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} animate-spin`}>
        <div className="w-full h-full border-4 border-gray-200 border-t-orange-500 rounded-full"></div>
      </div>
      {text && (
        <p className="mt-2 text-sm text-gray-600">{text}</p>
      )}
    </div>
  )
}

export function ArticleCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow animate-pulse">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-1"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
          <div className="flex items-center space-x-4">
            <div className="h-3 bg-gray-200 rounded w-16"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <div className="w-5 h-5 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}
