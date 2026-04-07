import React, {useCallback} from 'react';
import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {Button} from '@sqlrooms/ui';
import {Check, X, Hotel} from 'lucide-react';
import type {BookHotelInput} from '../agents/TravelPlannerAgent';
import {useRoomStore} from '../store';

/**
 * Renderer for the `bookHotel` tool which uses `needsApproval: true`.
 *
 * When the tool reaches `approval-requested` inside a sub-agent, this
 * component shows a confirmation card with the booking details and
 * Approve / Deny buttons. Clicking either dispatches
 * `resolveSubAgentApproval` which resumes the sub-agent loop.
 */
export const BookHotelApprovalRenderer: React.FC<
  ToolRendererProps<
    {
      confirmationCode: string;
      hotelName: string;
      city: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      totalPrice: number;
    },
    BookHotelInput
  >
> = ({input, output, state, approvalId}) => {
  const resolveSubAgentApproval = useRoomStore(
    (s) => s.ai.resolveSubAgentApproval,
  );

  const respond = useCallback(
    (approved: boolean) => {
      if (!approvalId) return;
      resolveSubAgentApproval(approvalId, approved);
    },
    [approvalId, resolveSubAgentApproval],
  );

  const nights = input
    ? Math.max(
        1,
        Math.round(
          (new Date(input.checkOut).getTime() -
            new Date(input.checkIn).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;
  const total = nights * (input?.pricePerNight ?? 0);

  if (state === 'approval-requested') {
    return (
      <div className="my-2 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
          <Hotel className="h-4 w-4" />
          Approve hotel booking?
        </div>
        <dl className="mb-3 space-y-1 text-sm text-amber-900 dark:text-amber-100">
          <div className="flex justify-between">
            <dt className="font-medium">Hotel</dt>
            <dd>{input?.hotelName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium">City</dt>
            <dd>{input?.city}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium">Dates</dt>
            <dd>
              {input?.checkIn} → {input?.checkOut} ({nights}{' '}
              {nights === 1 ? 'night' : 'nights'})
            </dd>
          </div>
          <div className="flex justify-between border-t border-amber-300 pt-1 dark:border-amber-700">
            <dt className="font-semibold">Total</dt>
            <dd className="font-semibold">${total.toFixed(2)}</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="flex items-center gap-1"
            onClick={() => respond(true)}
          >
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1"
            onClick={() => respond(false)}
          >
            <X className="h-3.5 w-3.5" /> Deny
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'output-denied') {
    return (
      <div className="my-2 max-w-sm rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        Booking denied by user.
      </div>
    );
  }

  if (state === 'output-available' && output) {
    return (
      <div className="my-2 max-w-sm rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        <span className="font-medium">Booked!</span> {output.hotelName} in{' '}
        {output.city} — confirmation <code>{output.confirmationCode}</code>,{' '}
        {output.nights} {output.nights === 1 ? 'night' : 'nights'}, $
        {output.totalPrice.toFixed(2)} total.
      </div>
    );
  }

  return null;
};
