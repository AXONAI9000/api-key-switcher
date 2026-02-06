using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using ApiKeySyncServer.Models;
using ApiKeySyncServer.Services;

namespace ApiKeySyncServer.Tests;

public class SyncServiceTests : IDisposable
{
    private readonly SyncService _syncService;
    private readonly string _tempDataDir;

    public SyncServiceTests()
    {
        _tempDataDir = Path.Combine(Path.GetTempPath(), $"sync-test-{Guid.NewGuid()}");
        Directory.CreateDirectory(_tempDataDir);

        var configValues = new Dictionary<string, string?>
        {
            { "DataDirectory", _tempDataDir }
        };

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configValues)
            .Build();

        var loggerMock = new Mock<ILogger<SyncService>>();
        _syncService = new SyncService(configuration, loggerMock.Object);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDataDir))
        {
            Directory.Delete(_tempDataDir, true);
        }
    }

    private EncryptedPackage CreateTestPackage(string deviceId = "test-device")
    {
        return new EncryptedPackage
        {
            EncryptedData = Convert.ToBase64String(new byte[] { 1, 2, 3, 4, 5 }),
            Iv = Convert.ToBase64String(new byte[] { 6, 7, 8, 9 }),
            Salt = Convert.ToBase64String(new byte[] { 10, 11, 12, 13 }),
            Checksum = "abc123checksum",
            Version = 1,
            Timestamp = DateTime.UtcNow.ToString("o"),
            DeviceId = deviceId
        };
    }

    [Fact]
    public async Task SaveConfigAsync_ShouldReturnSuccess()
    {
        var userId = Guid.NewGuid();
        var package = CreateTestPackage();

        var result = await _syncService.SaveConfigAsync(userId, package);

        Assert.True(result.Success);
        Assert.NotNull(result.Timestamp);
    }

    [Fact]
    public async Task GetConfigAsync_AfterSave_ShouldReturnData()
    {
        var userId = Guid.NewGuid();
        var package = CreateTestPackage("my-device");

        await _syncService.SaveConfigAsync(userId, package);
        var result = await _syncService.GetConfigAsync(userId);

        Assert.NotNull(result);
        Assert.Equal("my-device", result!.DeviceId);
        Assert.Equal(1, result.Version);
        Assert.Equal(package.Checksum, result.Checksum);
    }

    [Fact]
    public async Task GetConfigAsync_NoData_ShouldReturnNull()
    {
        var userId = Guid.NewGuid();

        var result = await _syncService.GetConfigAsync(userId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetStatusAsync_NoData_ShouldReturnConnectedWithoutData()
    {
        var userId = Guid.NewGuid();

        var status = await _syncService.GetStatusAsync(userId);

        Assert.True(status.Connected);
        Assert.False(status.HasData);
        Assert.Null(status.LastUpdated);
    }

    [Fact]
    public async Task GetStatusAsync_WithData_ShouldReturnCorrectStatus()
    {
        var userId = Guid.NewGuid();
        var package = CreateTestPackage("status-device");

        await _syncService.SaveConfigAsync(userId, package);
        var status = await _syncService.GetStatusAsync(userId);

        Assert.True(status.Connected);
        Assert.True(status.HasData);
        Assert.Equal("status-device", status.DeviceId);
        Assert.Equal(1, status.Version);
    }

    [Fact]
    public async Task SaveConfigAsync_OverwriteExisting_ShouldSucceed()
    {
        var userId = Guid.NewGuid();

        var package1 = CreateTestPackage("device-v1");
        await _syncService.SaveConfigAsync(userId, package1);

        var package2 = CreateTestPackage("device-v2");
        package2.Checksum = "updated-checksum";
        var result = await _syncService.SaveConfigAsync(userId, package2);

        Assert.True(result.Success);

        var config = await _syncService.GetConfigAsync(userId);
        Assert.Equal("device-v2", config!.DeviceId);
        Assert.Equal("updated-checksum", config.Checksum);
    }

    [Fact]
    public async Task GetConfigAsync_DifferentUsers_ShouldBeIsolated()
    {
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();

        var package1 = CreateTestPackage("user1-device");
        var package2 = CreateTestPackage("user2-device");

        await _syncService.SaveConfigAsync(userId1, package1);
        await _syncService.SaveConfigAsync(userId2, package2);

        var config1 = await _syncService.GetConfigAsync(userId1);
        var config2 = await _syncService.GetConfigAsync(userId2);

        Assert.Equal("user1-device", config1!.DeviceId);
        Assert.Equal("user2-device", config2!.DeviceId);
    }

    [Fact]
    public async Task SaveConfigAsync_PreservesAllFields()
    {
        var userId = Guid.NewGuid();
        var package = new EncryptedPackage
        {
            EncryptedData = Convert.ToBase64String(new byte[] { 100, 200 }),
            Iv = Convert.ToBase64String(new byte[] { 50, 60 }),
            Salt = Convert.ToBase64String(new byte[] { 70, 80 }),
            Checksum = "full-checksum-test",
            Version = 2,
            Timestamp = "2025-01-15T12:00:00.000Z",
            DeviceId = "full-test-device"
        };

        await _syncService.SaveConfigAsync(userId, package);
        var result = await _syncService.GetConfigAsync(userId);

        Assert.NotNull(result);
        Assert.Equal(package.EncryptedData, result!.EncryptedData);
        Assert.Equal(package.Iv, result.Iv);
        Assert.Equal(package.Salt, result.Salt);
        Assert.Equal("full-checksum-test", result.Checksum);
        Assert.Equal(2, result.Version);
        Assert.Equal("full-test-device", result.DeviceId);
    }
}
