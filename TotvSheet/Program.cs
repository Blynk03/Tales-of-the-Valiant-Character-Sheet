using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using TotvSheet;
using TotvSheet.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<StorageService>();
builder.Services.AddScoped<ContentService>();
builder.Services.AddScoped<CharacterService>();
builder.Services.AddScoped<DiceService>();

await builder.Build().RunAsync();
