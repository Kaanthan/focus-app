
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

console.log("RevenueCat Webhook Function Loaded")

serve(async (req) => {
    try {
        // 1. Authorize Request (Basic check)
        const { method } = req
        if (method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 })
        }

        // 2. Parse RevenueCat Payload
        const payload = await req.json()
        const { event, api_version } = payload

        console.log(`Received Event: ${event?.type} for User: ${event?.app_user_id}`)

        // 3. Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 4. Handle Specific Events
        // Focus App Pro entitlement check
        // Logic: If event implies active sub -> is_pro = true. Else -> is_pro = false.
        // Events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, ETC.

        const userId = event?.app_user_id
        if (!userId) {
            return new Response(JSON.stringify({ error: 'No app_user_id' }), { status: 400 })
        }

        // Check for "Focus App Pro" entitlement in the event?
        // Actually, simpler to just trust the event type for now, or just query RC API?
        // For this MVP, we just map event types to status.

        let isPro = false

        switch (event?.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'UNCANCELLATION':
            case 'NON_RENEWING_PURCHASE':
                isPro = true
                break
            case 'CANCELLATION': // Cancellation might just mean "won't renew", usually they stay pro until expiration.
                // STRICTLY SPEAKING: Cancellation = turns off auto-renew. Expiration = loses access.
                // But for simplicity in MVP, we might want to keep them Pro until Expiration.
                // Let's assume CANCELLATION event from RC means "Cancelled" but check expiration?
                // Actually, RC sends EXPIRATION event when it actually expires.
                isPro = true
                break;
            case 'EXPIRATION':
            case 'BILLING_ISSUE':
                isPro = false
                break
            default:
                // TEST or unknown
                console.log("Unhandled event type:", event?.type)
                return new Response(JSON.stringify({ message: 'Unhandled event type' }), { status: 200 })
        }

        // 5. Update Profile
        // WARNING: This assumes app_user_id IS the Supabase User ID (uuid).
        // If you used email or anonymous ID for RC, this will fail. 
        // Ensure on client side: Purchases.logIn(supabase.auth.user.id)

        const { error } = await supabase
            .from('profiles')
            .update({ is_pro: isPro, updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (error) {
            console.error('Supabase Update Error:', error)
            return new Response(JSON.stringify({ error: error.message }), { status: 500 })
        }

        return new Response(JSON.stringify({ message: `Updated user ${userId} to Pro: ${isPro}` }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error) {
        console.error('Function Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        })
    }
})
