// SofaPad.app: a menu bar wrapper around sofapad.py.
// It runs /usr/bin/python3 on the bundled script as a child process, so macOS
// gives the Accessibility permission to SofaPad itself instead of Terminal.
#import <Cocoa/Cocoa.h>

@interface AppDelegate : NSObject <NSApplicationDelegate>
@property (strong) NSStatusItem *item;
@property (strong) NSTask *task;
@property (strong) NSFileHandle *logFile;
@property (strong) NSMutableString *pending;
@property (strong) NSMenuItem *stateItem, *urlItem, *pinItem, *accessItem;
@property (copy) NSString *url;
@end

@implementation AppDelegate

- (NSString *)logPath {
    return [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Logs/SofaPad.log"];
}

- (NSMenuItem *)addItem:(NSMenu *)menu title:(NSString *)title action:(SEL)action {
    NSMenuItem *mi = [[NSMenuItem alloc] initWithTitle:title action:action keyEquivalent:@""];
    mi.target = self;
    [menu addItem:mi];
    return mi;
}

- (void)applicationDidFinishLaunching:(NSNotification *)note {
    self.item = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
    self.item.button.title = @"⌨︎";
    self.item.button.toolTip = @"SofaPad";

    NSMenu *menu = [[NSMenu alloc] init];
    menu.autoenablesItems = NO;
    self.stateItem = [self addItem:menu title:@"SofaPad: starting…" action:nil];
    self.stateItem.enabled = NO;
    self.urlItem = [self addItem:menu title:@"" action:@selector(copyURL:)];
    self.urlItem.hidden = YES;
    self.pinItem = [self addItem:menu title:@"" action:nil];
    self.pinItem.enabled = NO;
    self.pinItem.hidden = YES;
    self.accessItem = [self addItem:menu title:@"⚠️ Allow SofaPad in Accessibility… / 開啟輔助使用設定" action:@selector(openAccess:)];
    self.accessItem.hidden = YES;
    [menu addItem:[NSMenuItem separatorItem]];
    [self addItem:menu title:@"Open Log / 開啟紀錄" action:@selector(openLog:)];
    [self addItem:menu title:@"Quit SofaPad / 結束" action:@selector(quit:)];
    self.item.menu = menu;

    [self startHelper];
}

- (void)startHelper {
    [[NSFileManager defaultManager] createFileAtPath:[self logPath] contents:nil attributes:nil];
    self.logFile = [NSFileHandle fileHandleForWritingAtPath:[self logPath]];
    self.pending = [NSMutableString string];

    NSString *script = [[NSBundle mainBundle] pathForResource:@"sofapad" ofType:@"py"];
    NSTask *task = [[NSTask alloc] init];
    task.executableURL = [NSURL fileURLWithPath:@"/usr/bin/python3"];
    task.arguments = @[@"-B", @"-u", script, @"--app"];
    task.currentDirectoryURL = [NSURL fileURLWithPath:[script stringByDeletingLastPathComponent]];
    NSPipe *pipe = [NSPipe pipe];
    task.standardOutput = pipe;
    task.standardError = pipe;

    __weak AppDelegate *weakSelf = self;
    pipe.fileHandleForReading.readabilityHandler = ^(NSFileHandle *h) {
        NSData *data = h.availableData;
        if (data.length == 0) { h.readabilityHandler = nil; return; }
        dispatch_async(dispatch_get_main_queue(), ^{ [weakSelf gotOutput:data]; });
    };
    task.terminationHandler = ^(NSTask *t) {
        dispatch_async(dispatch_get_main_queue(), ^{
            weakSelf.stateItem.title = [NSString stringWithFormat:@"SofaPad stopped (exit %d) – see log / 已停止", t.terminationStatus];
            weakSelf.item.button.title = @"⌨︎!";
            weakSelf.urlItem.hidden = YES;
            weakSelf.pinItem.hidden = YES;
        });
    };

    NSError *err = nil;
    if (![task launchAndReturnError:&err]) {
        self.stateItem.title = [NSString stringWithFormat:@"Could not start python3: %@", err.localizedDescription];
        return;
    }
    self.task = task;
}

- (void)gotOutput:(NSData *)data {
    [self.logFile seekToEndOfFile];
    [self.logFile writeData:data];
    NSString *s = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (!s) return;
    [self.pending appendString:s];
    NSRange nl;
    while ((nl = [self.pending rangeOfString:@"\n"]).location != NSNotFound) {
        NSString *line = [self.pending substringToIndex:nl.location];
        [self.pending deleteCharactersInRange:NSMakeRange(0, nl.location + 1)];
        [self handleLine:line];
    }
}

- (void)handleLine:(NSString *)line {
    if ([line hasPrefix:@"@@url "]) {
        self.url = [line substringFromIndex:6];
        self.stateItem.title = @"SofaPad is running / 執行中";
        self.urlItem.title = [NSString stringWithFormat:@"%@  (click to copy / 點一下複製)", self.url];
        self.urlItem.hidden = NO;
    } else if ([line hasPrefix:@"@@pin "]) {
        self.pinItem.title = [NSString stringWithFormat:@"PIN: %@", [line substringFromIndex:6]];
        self.pinItem.hidden = NO;
    } else if ([line hasPrefix:@"@@access "]) {
        BOOL blocked = [[line substringFromIndex:9] isEqualToString:@"blocked"];
        self.accessItem.hidden = !blocked;
        self.item.button.title = blocked ? @"⌨︎⚠️" : @"⌨︎";
    }
}

- (void)copyURL:(id)sender {
    if (!self.url) return;
    [[NSPasteboard generalPasteboard] clearContents];
    [[NSPasteboard generalPasteboard] setString:self.url forType:NSPasteboardTypeString];
}

- (void)openAccess:(id)sender {
    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"]];
}

- (void)openLog:(id)sender {
    [[NSWorkspace sharedWorkspace] openURL:[NSURL fileURLWithPath:[self logPath]]];
}

- (void)quit:(id)sender {
    [NSApp terminate:nil];
}

- (void)applicationWillTerminate:(NSNotification *)note {
    if (self.task.running) {
        [self.task terminate];
        [self.task waitUntilExit];
    }
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app setActivationPolicy:NSApplicationActivationPolicyAccessory];
        [app run];
    }
    return 0;
}
