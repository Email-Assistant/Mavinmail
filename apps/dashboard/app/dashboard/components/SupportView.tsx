"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function SupportView() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Support</h2>
                <p className="text-muted-foreground">Need help? We've got you covered.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">Contact Us</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Send us a message and we'll get back to you.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="subject" className="text-foreground">Subject</Label>
                            <Input id="subject" placeholder="I need help with..." className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="message" className="text-foreground">Message</Label>
                            <Textarea id="message" placeholder="Describe your issue..." className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50 min-h-[150px]" />
                        </div>
                        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Send Message</Button>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">Frequently Asked Questions</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Quick answers to common questions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Since I didn't install Accordion, I'll just use a simple list or install it. 
                 Wait, I should install accordion. It's standard for FAQ. 
                 But for now I'll just use a simple list to avoid another install step if I can.
                 Actually, I'll just use details/summary for native accordion behavior or standard divs.
                 Let's use native details/summary for simplicity and speed.
              */}
                        <div className="space-y-4">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1" className="border-border">
                                    <AccordionTrigger className="text-foreground hover:text-primary hover:no-underline">How do I connect a new account?</AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        Go to the Connected Accounts tab and click the "Add Account" button in the top right corner.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-2" className="border-border">
                                    <AccordionTrigger className="text-foreground hover:text-primary hover:no-underline">Is my data secure?</AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        Yes, we use enterprise-grade encryption for all your data. We never share your emails with third parties.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-3" className="border-border">
                                    <AccordionTrigger className="text-foreground hover:text-primary hover:no-underline">Can I change my plan later?</AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        Absolutely. You can upgrade or downgrade your subscription at any time from the Subscription tab.
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
